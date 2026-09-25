"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import * as tf from "@tensorflow/tfjs-core";
import { LayersModel, loadLayersModel } from "@tensorflow/tfjs-layers";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import { SabLayout, StemMasks } from "../models/audio-features.js";
import { Command, InitializeCommand, LoadMaskModelCommand } from "../models/audio-analyzer-commands.js";

const { round, max, trunc } = Math;

/** resources/data/stem-mask/meta.json — frames: context window, rate: inferences per second, smoothing: EMA blend per inference. */
interface MaskModelMeta {
	frames: number;
	rate: number;
	smoothing: number;
}

//#region Stem mask worker
/**
 * Samples the model tap (inSAB) onto its own fixed 60Hz grid — independent of Visualizer.rate
 * (30-1200fps, user-configurable) — because the model was trained on a fixed 60fps hop;
 * publishing frames 1:1 would silently desync its 267ms context window. The grid is kept by the
 * wall clock, not by counting timer callbacks: an inference takes longer than a grid step, so
 * callbacks arrive late, and every missed step is filled by interpolating between the previous and
 * the current tap — otherwise the window would silently stretch to twice its trained duration.
 * Runs inference at the reduced rate from meta.json (at most once per callback, when the grid
 * crosses a multiple of the divisor) and EMA-smooths the result into the mask SAB (outSAB here —
 * InitializeCommand is reused unchanged from the audio-analyzer worker, pointed at other buffers).
 */
class StemMaskWorker extends Controller {
	static #grid: number = 60; // Hz

	#tap: Float32Array | null = null;
	#masks: StemMasks | null = null;

	#model: LayersModel | null = null;
	#frames: number = 0;
	#divisor: number = 1;
	#smoothing: number = 0.5;
	#ring: Float32Array = new Float32Array(0);
	#cursor: number = 0;
	#origin: number | null = null;
	#steps: number = 0;
	#previous: Float32Array = new Float32Array(SabLayout.bins);
	#frame: Float32Array = new Float32Array(SabLayout.bins);
	#smoothed: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems).fill(1 / SabLayout.stems);

	#capture(): void {
		const tap = this.#tap;
		const masks = this.#masks;
		const model = this.#model;
		if (tap === null || masks === null || model === null) return;

		const now = performance.now();
		const origin = this.#origin;
		if (origin === null) {
			this.#origin = now;
			this.#previous.set(tap);
			return;
		}

		const due = trunc((now - origin) * StemMaskWorker.#grid / 1000);
		const count = due - this.#steps;
		if (count <= 0) return;
		this.#advance(tap, count);

		const infer = trunc(due / this.#divisor) > trunc(this.#steps / this.#divisor);
		this.#steps = due;
		if (infer) this.#infer(model, masks);
	}

	/** Pushes `count` grid steps into the ring, each interpolated from the previous tap toward the current one; steps older than the whole window are skipped. */
	#advance(tap: Float32Array, count: number): void {
		const bins = SabLayout.bins;
		const frames = this.#frames;
		const previous = this.#previous;
		const frame = this.#frame;
		for (let step = max(1, count - frames + 1); step <= count; step++) {
			const weight = step / count;
			for (let bin = 0; bin < bins; bin++) frame[bin] = previous[bin] + (tap[bin] - previous[bin]) * weight;
			this.#ring.set(frame, this.#cursor * bins);
			this.#cursor = (this.#cursor + 1) % frames;
		}
		previous.set(tap);
	}

	#infer(model: LayersModel, masks: StemMasks): void {
		const bins = SabLayout.bins;
		const frames = this.#frames;
		const ring = this.#ring;

		// Bin-major/time-minor, oldest -> newest — the layout the model was trained on: tensor3d(x, [bins, frames]).
		const packed = new Float32Array(bins * frames);
		for (let offset = 0; offset < frames; offset++) {
			const base = ((this.#cursor + offset) % frames) * bins;
			for (let bin = 0; bin < bins; bin++) packed[bin * frames + offset] = ring[base + bin];
		}

		const predicted = tf.tidy(() => (model.predict(tf.tensor3d(packed, [1, bins, frames])) as tf.Tensor).dataSync() as Float32Array);

		const smoothed = this.#smoothed;
		for (let index = 0; index < smoothed.length; index++) smoothed[index] += (predicted[index] - smoothed[index]) * this.#smoothing;
		masks.publish(smoothed, performance.timeOrigin + performance.now());
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof InitializeCommand) {
			const { inSAB, outSAB } = command;
			this.#tap = new Float32Array(inSAB, 20 + SabLayout.inputMaxLength * 4 * 2, SabLayout.bins);
			this.#masks = new StemMasks(outSAB);
			return;
		}

		if (command instanceof LoadMaskModelCommand) {
			void this.#load(command.urlModel, command.urlWasm);
			return;
		}
	}

	async #load(urlModel: string, urlWasm: string): Promise<void> {
		setWasmPaths(urlWasm);
		// The threaded-simd variant spawns its own sub-workers, which breaks when tfjs itself already
		// runs inside a worker ("u is not defined" from WasmBackendModuleThreadedSimd) — plain SIMD
		// is still fast and avoids nested workers.
		tf.env().set("WASM_HAS_MULTITHREAD_SUPPORT", false);
		await tf.setBackend("wasm");
		await tf.ready();

		const meta = await (await fetch(new URL("meta.json", urlModel))).json() as MaskModelMeta;
		this.#frames = meta.frames;
		this.#divisor = max(1, round(StemMaskWorker.#grid / meta.rate));
		this.#smoothing = meta.smoothing;
		this.#ring = new Float32Array(meta.frames * SabLayout.bins);

		this.#model = await loadLayersModel(urlModel);
	}

	async run(): Promise<void> {
		setInterval(this.#capture.bind(this), 1000 / StemMaskWorker.#grid);
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await StemMaskWorker.launch();
