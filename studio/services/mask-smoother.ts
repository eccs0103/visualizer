"use strict";

import "adaptive-extender/worker";
import { SabLayout } from "../models/audio-features.js";

//#region Mask smoother
/** The masks the AI worker publishes: each prediction moves them only part of the way, by time rather than by count, so the stems feel the same at any update rate. */
export class MaskSmoother {
	static #halflife: number = 100;

	#smoothed: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems).fill(1 / SabLayout.stems);
	#published: number | null = null;

	/** Moves the masks toward `predicted` at `now` (ms): half the way per `halflife` ms since the last call (0.5 at the old 10/s), all the way on the first. */
	smooth(predicted: Float32Array, now: number): Float32Array {
		const smoothed = this.#smoothed;
		const smoothing = this.#smoothing(now);
		for (let index = 0; index < smoothed.length; index++) smoothed[index] += (predicted[index] - smoothed[index]) * smoothing;
		return smoothed;
	}

	/** Back to the uniform prior: an honest "no separation". */
	reset(): Float32Array {
		return this.#smoothed.fill(1 / SabLayout.stems);
	}

	#smoothing(now: number): number {
		const published = this.#published;
		this.#published = now;
		if (published === null) return 1;
		return 1 - 0.5 ** ((now - published) / MaskSmoother.#halflife);
	}
}
//#endregion
