"use strict";

import "adaptive-extender/worker";
import { SabLayout } from "../models/audio-features.js";

const { max, trunc } = Math;

//#region Tap history
/** The last `frames` frames of the AI's analyser tap on a steady 60 Hz grid, whatever rate the page actually renders at: every grid step since the last capture is interpolated from the previous tap toward the new one. */
export class TapHistory {
	static #grid: number = 60;

	#frames: number;
	#ring: Float32Array;
	#packed: Float32Array<ArrayBuffer>;
	#cursor: number = 0;
	#origin: number | null = null;
	#steps: number = 0;
	#previous: Float32Array = new Float32Array(SabLayout.bins);
	#frame: Float32Array = new Float32Array(SabLayout.bins);

	constructor(frames: number) {
		this.#frames = frames;
		this.#ring = new Float32Array(frames * SabLayout.bins);
		this.#packed = new Float32Array(frames * SabLayout.bins);
	}

	/** Takes the tap at `now` (ms); returns whether any grid step became due since the last capture. The first capture only sets the grid's origin. */
	capture(tap: Float32Array, now: number): boolean {
		const origin = this.#origin;
		if (origin === null) {
			this.#origin = now;
			this.#previous.set(tap);
			return false;
		}
		const due = trunc((now - origin) * TapHistory.#grid / 1000);
		const count = due - this.#steps;
		if (count <= 0) return false;
		this.#advance(tap, count);
		this.#steps = due;
		return true;
	}

	/** The window as the network reads it: one row of bins per frame, oldest → newest. */
	pack(): Float32Array<ArrayBuffer> {
		const bins = SabLayout.bins;
		const frames = this.#frames;
		const ring = this.#ring;
		const cursor = this.#cursor;
		const packed = this.#packed;
		for (let offset = 0; offset < frames; offset++) {
			const base = ((cursor + offset) % frames) * bins;
			packed.set(ring.subarray(base, base + bins), offset * bins);
		}
		return packed;
	}

	/** Pushes `count` grid steps into the ring, each interpolated from the previous tap toward the current one; steps older than the whole window are skipped. */
	#advance(tap: Float32Array, count: number): void {
		const bins = SabLayout.bins;
		const frames = this.#frames;
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
}
//#endregion
