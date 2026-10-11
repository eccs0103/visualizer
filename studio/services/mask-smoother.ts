"use strict";

import "adaptive-extender/worker";
import { SabLayout } from "../models/audio-features.js";

//#region Mask smoother
export class MaskSmoother {
	static #halflife: number = 100;

	#smoothed: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems).fill(1 / SabLayout.stems);
	#published: number | null = null;

	smooth(predicted: Float32Array, now: number): Float32Array {
		const smoothed = this.#smoothed;
		const smoothing = this.#smoothing(now);
		for (let index = 0; index < smoothed.length; index++) smoothed[index] += (predicted[index] - smoothed[index]) * smoothing;
		return smoothed;
	}

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
