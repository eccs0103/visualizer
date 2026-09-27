"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import * as tf from "@tensorflow/tfjs-core";
import { LayersModel, loadLayersModel } from "@tensorflow/tfjs-layers";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import { SabLayout, Signal, StemMasks } from "../models/audio-features.js";
import { Command, InitializeMaskCommand, TickCommand } from "../models/commands.js";

const { max, trunc } = Math;

//#region Stem mask worker
class StemMaskWorker extends Controller {
	static #grid: number = 60;
	static #frames: number = 16;
	static #divisor: number = 6;
	static #smoothing: number = 0.5;

	#signal: Signal | null = null;
	#masks: StemMasks | null = null;
	#model: LayersModel | null = null;
	#ring: Float32Array = new Float32Array(StemMaskWorker.#frames * SabLayout.bins);
	#cursor: number = 0;
	#origin: number | null = null;
	#steps: number = 0;
	#previous: Float32Array = new Float32Array(SabLayout.bins);
	#frame: Float32Array = new Float32Array(SabLayout.bins);
	#smoothed: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems).fill(1 / SabLayout.stems);

	#capture(tap: Float32Array, masks: StemMasks, model: LayersModel): void {
		const now = performance.now();
		const origin = this.#origin;
		if (origin === null) {
			this.#origin = now;
			this.#previous.set(tap);
			return;
		}

		const due = trunc((now - origin) * StemMaskWorker.#grid / 1000);
		const steps = this.#steps;
		const count = due - steps;
		if (count <= 0) return;
		this.#advance(tap, count);

		const divisor = StemMaskWorker.#divisor;
		const infer = trunc(due / divisor) > trunc(steps / divisor);
		this.#steps = due;
		if (infer) this.#infer(model, masks);
	}

	/** Pushes `count` grid steps into the ring, each interpolated from the previous tap toward the current one; steps older than the whole window are skipped. */
	#advance(tap: Float32Array, count: number): void {
		const bins = SabLayout.bins;
		const frames = StemMaskWorker.#frames;
		const previous = this.#previous;
		const frame = this.#frame;
		const ring = this.#ring;
		let cursor = this.#cursor;
		for (let step = max(1, count - frames + 1); step <= count; step++) {
			const weight = step / count;
			for (let bin = 0; bin < bins; bin++) frame[bin] = previous[bin] + (tap[bin] - previous[bin]) * weight;
			ring.set(frame, cursor * bins);
			cursor = (cursor + 1) % frames;
		}
		this.#cursor = cursor;
		previous.set(tap);
	}

	#infer(model: LayersModel, masks: StemMasks): void {
		const bins = SabLayout.bins;
		const frames = StemMaskWorker.#frames;
		const ring = this.#ring;
		const cursor = this.#cursor;

		// Bin-major/time-minor, oldest -> newest — the layout the model was trained on: tensor3d(x, [bins, frames]).
		const packed = new Float32Array(bins * frames);
		for (let offset = 0; offset < frames; offset++) {
			const base = ((cursor + offset) % frames) * bins;
			for (let bin = 0; bin < bins; bin++) packed[bin * frames + offset] = ring[base + bin];
		}

		const predicted = tf.tidy(() => (model.predict(tf.tensor3d(packed, [1, bins, frames])) as tf.Tensor).dataSync() as Float32Array);

		const smoothed = this.#smoothed;
		const smoothing = StemMaskWorker.#smoothing;
		for (let index = 0; index < smoothed.length; index++) smoothed[index] += (predicted[index] - smoothed[index]) * smoothing;
		masks.publish(smoothed, performance.timeOrigin + performance.now());
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof InitializeMaskCommand) {
			this.#signal = new Signal(command.sabSignal);
			this.#masks = new StemMasks(command.sabMask);
			void this.#load(command.urlModel, command.urlWasm);
			return;
		}

		if (command instanceof TickCommand) {
			const signal = this.#signal, masks = this.#masks, model = this.#model;
			if (signal === null || masks === null || model === null) return;
			this.#capture(signal.model, masks, model);
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
		this.#model = await loadLayersModel(urlModel);
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await StemMaskWorker.launch();
