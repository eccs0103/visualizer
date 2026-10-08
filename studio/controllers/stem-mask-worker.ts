"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { SabLayout, Signal, StemMasks } from "../models/audio-features.js";
import { Command, InitializeMaskCommand, StatusMaskCommand, TickCommand } from "../models/commands.js";
import { StemNetwork } from "../services/stem-network.js";

const { max, round, trunc } = Math;

//#region Inference pace
/**
 * Keeps the splitter's share of the GPU under a budget (40%: on an Intel UHD 630 even 100% cost one dropped frame in 3 s), because on an integrated GPU the same chip also draws the visuals: it measures what one inference costs and lets the next one start only after `cost / budget` since the last start, so a weak GPU slows the AI down instead of the visuals. A strong GPU never hits the budget and keeps the normal pace. It also measures how many inferences finish per second.
 */
class InferencePace {
	static #budget: number = 0.4;
	static #tolerance: number = 0.75;
	static #learning: number = 0.2;
	static #window: number = 1000;
	static #gap: number = 2000;

	#cost: number | null = null;
	#started: number | null = null;
	#opened: number | null = null;
	#count: number = 0;
	#rate: number | null = null;

	/** Inferences finished per second over the last measured window; `null` until the first window closes. */
	get rate(): number | null { return this.#rate; }

	/** Whether the budget holds the AI clearly below its normal pace (`period` ms between inferences): under `tolerance` of it, so the answer doesn't flicker near the edge. */
	slowed(period: number): boolean {
		const cost = this.#cost;
		if (cost === null) return false;
		return cost / InferencePace.#budget > period / InferencePace.#tolerance;
	}

	ready(now: number): boolean {
		const cost = this.#cost, started = this.#started;
		if (cost === null || started === null) return true;
		return now - started >= cost / InferencePace.#budget;
	}

	start(now: number): void {
		this.#started = now;
	}

	/** Records the inference that started last; returns whether that closed a window with a new `rate`. */
	finish(now: number): boolean {
		const started = this.#started;
		if (started === null) throw new ReferenceError("No inference was started");
		const cost = this.#cost;
		const spent = now - started;
		this.#cost = cost === null ? spent : cost + (spent - cost) * InferencePace.#learning;

		const opened = this.#opened;
		if (opened === null || now - opened > InferencePace.#gap) {
			this.#open(now);
			return false;
		}
		const count = ++this.#count;
		const elapsed = now - opened;
		if (elapsed < InferencePace.#window) return false;
		this.#rate = round(count * 1000 / elapsed);
		this.#open(now);
		return true;
	}

	#open(now: number): void {
		this.#opened = now;
		this.#count = 0;
	}
}
//#endregion
//#region Stem mask worker
class StemMaskWorker extends Controller {
	static #grid: number = 60;
	static #frames: number = 16;
	static #divisor: number = 1;
	static #halflife: number = 100;
	static #acceptable: number = 100;

	#signal: Signal | null = null;
	#masks: StemMasks | null = null;
	#network: StemNetwork | null = null;
	#busy: boolean = false;
	#pace: InferencePace = new InferencePace();
	#status: StatusMaskCommand | null = null;
	#ring: Float32Array = new Float32Array(StemMaskWorker.#frames * SabLayout.bins);
	#packed: Float32Array<ArrayBuffer> = new Float32Array(StemMaskWorker.#frames * SabLayout.bins);
	#cursor: number = 0;
	#origin: number | null = null;
	#steps: number = 0;
	#previous: Float32Array = new Float32Array(SabLayout.bins);
	#frame: Float32Array = new Float32Array(SabLayout.bins);
	#smoothed: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems).fill(1 / SabLayout.stems);
	#folded: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems);
	#published: number | null = null;

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
		if (infer && this.#pace.ready(now)) void this.#infer(network, masks);
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
		const pace = this.#pace;
		try {
			pace.start(performance.now());
			const predicted = this.#fold(await network.infer(this.#pack()), network.stems);
			const now = performance.now();
			const smoothed = this.#smoothed;
			const smoothing = this.#smoothing(now);
			for (let index = 0; index < smoothed.length; index++) smoothed[index] += (predicted[index] - smoothed[index]) * smoothing;
			masks.publish(smoothed, performance.timeOrigin + now);
			if (pace.finish(now)) this.#report(new StatusMaskCommand(true, null, network.adapter, pace.rate, pace.slowed(StemMaskWorker.#acceptable)));
		} catch (reason) {
			this.#disable(reason);
		} finally {
			this.#busy = false;
		}
	}

	/** How far the smoothed masks move toward a new prediction: half the way per `halflife` ms since the last publication, so the stems feel the same at any update rate (0.5 at the old 10/s). */
	#smoothing(now: number): number {
		const published = this.#published;
		this.#published = now;
		if (published === null) return 1;
		return 1 - 0.5 ** ((now - published) / StemMaskWorker.#halflife);
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

	async #load(url: string): Promise<void> {
		try {
			const network = await StemNetwork.create(new URL(url), StemMaskWorker.#frames, SabLayout.bins);
			if (network.stems < SabLayout.stems) throw new TypeError(`The model splits into ${network.stems} stems, the visualizer needs at least ${SabLayout.stems}`);
			this.#network = network;
			this.#report(new StatusMaskCommand(true, null, network.adapter, null, false));
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
		this.#report(new StatusMaskCommand(false, Error.from(reason).message, null, null, false));
	}

	/** Tells the main thread the splitter's state, only when something the user can see changed. */
	#report(status: StatusMaskCommand): void {
		const previous = this.#status;
		if (previous !== null && previous.equals(status)) return;
		this.#status = status;
		self.postMessage(Command.export(status));
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await StemMaskWorker.launch();
