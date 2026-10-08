"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { SabLayout, Signal, StemMasks } from "../models/audio-features.js";
import { Command, InitializeMaskCommand, StatusMaskCommand, TickCommand } from "../models/commands.js";
import { StemNetwork } from "../services/stem-network.js";

const { max, trunc } = Math;

//#region Stem mask worker
class StemMaskWorker extends Controller {
	static #grid: number = 60;
	static #frames: number = 16;
	static #divisor: number = 6;
	static #smoothing: number = 0.5;

	#signal: Signal | null = null;
	#masks: StemMasks | null = null;
	#network: StemNetwork | null = null;
	#busy: boolean = false;
	#ring: Float32Array = new Float32Array(StemMaskWorker.#frames * SabLayout.bins);
	#packed: Float32Array<ArrayBuffer> = new Float32Array(StemMaskWorker.#frames * SabLayout.bins);
	#cursor: number = 0;
	#origin: number | null = null;
	#steps: number = 0;
	#previous: Float32Array = new Float32Array(SabLayout.bins);
	#frame: Float32Array = new Float32Array(SabLayout.bins);
	#smoothed: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems).fill(1 / SabLayout.stems);
	#folded: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems);

	#capture(tap: Float32Array, masks: StemMasks, network: StemNetwork): void {
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
		if (infer) void this.#infer(network, masks);
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

	/** Runs one inference unless the previous one is still on the GPU — a skipped step is dropped, never queued. */
	async #infer(network: StemNetwork, masks: StemMasks): Promise<void> {
		if (this.#busy) return;
		this.#busy = true;
		try {
			const predicted = this.#fold(await network.infer(this.#pack()), network.stems);
			const smoothed = this.#smoothed;
			const smoothing = StemMaskWorker.#smoothing;
			for (let index = 0; index < smoothed.length; index++) smoothed[index] += (predicted[index] - smoothed[index]) * smoothing;
			masks.publish(smoothed, performance.timeOrigin + performance.now());
		} catch (reason) {
			this.#disable(reason);
		} finally {
			this.#busy = false;
		}
	}

	/** The network's shares as the visualizer's stems: a model that splits finer (its extra stems come after the visualizer's own) has every extra stem summed into the last one, "other". */
	#fold(shares: Float32Array, count: number): Float32Array {
		const stems = SabLayout.stems;
		const folded = this.#folded;
		const last = stems - 1;
		for (let bin = 0; bin < SabLayout.bins; bin++) {
			const source = bin * count;
			const target = bin * stems;
			for (let stem = 0; stem < last; stem++) folded[target + stem] = shares[source + stem];
			let rest = 0;
			for (let stem = last; stem < count; stem++) rest += shares[source + stem];
			folded[target + last] = rest;
		}
		return folded;
	}

	/** The ring as the network reads it: one row of bins per frame, oldest -> newest. */
	#pack(): Float32Array<ArrayBuffer> {
		const bins = SabLayout.bins;
		const frames = StemMaskWorker.#frames;
		const ring = this.#ring;
		const cursor = this.#cursor;
		const packed = this.#packed;
		for (let offset = 0; offset < frames; offset++) {
			const base = ((cursor + offset) % frames) * bins;
			packed.set(ring.subarray(base, base + bins), offset * bins);
		}
		return packed;
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof InitializeMaskCommand) {
			this.#signal = new Signal(command.sabSignal);
			this.#masks = new StemMasks(command.sabMask);
			void this.#load(command.urlModel);
			return;
		}

		if (command instanceof TickCommand) {
			const signal = this.#signal, masks = this.#masks, network = this.#network;
			if (signal === null || masks === null || network === null) return;
			this.#capture(signal.model, masks, network);
		}
	}

	async #load(urlModel: string): Promise<void> {
		try {
			const network = await StemNetwork.create(new URL(urlModel), StemMaskWorker.#frames, SabLayout.bins);
			if (network.stems < SabLayout.stems) throw new TypeError(`The model splits into ${network.stems} stems, the visualizer needs at least ${SabLayout.stems}`);
			this.#network = network;
			self.postMessage(Command.export(new StatusMaskCommand(true, null)));
			const { message } = await network.lost;
			throw new Error(`The GPU device was lost: ${message}`);
		} catch (reason) {
			this.#disable(reason);
		}
	}

	/** Stops the splitter for good: the stems fall back to the uniform prior (an honest "no separation"), and the main thread learns why. */
	#disable(reason: unknown): void {
		this.#network = null;
		const smoothed = this.#smoothed.fill(1 / SabLayout.stems);
		this.#masks?.publish(smoothed, performance.timeOrigin + performance.now());
		self.postMessage(Command.export(new StatusMaskCommand(false, Error.from(reason).message)));
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await StemMaskWorker.launch();
