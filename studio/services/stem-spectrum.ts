"use strict";

import "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";
import { type Stem } from "../models/stem.js";
import { type StemGains } from "../models/stem-gains.js";
import { type MaskBlend } from "./mask-blend.js";

const { max } = Math;

//#region Stem spectrum
/** One stem's spectrum: the whole spectrum × the stem's mask (resampled from the model's bins onto the analyser's length: both are linear FFT bins over 0..Nyquist, so linear interpolation is exact) × the stem's gain. Built on first read and kept until `forget`. */
export class StemSpectrum {
	#stem: Stem;
	#values: Float32Array = new Float32Array(0);
	#fresh: boolean = false;

	constructor(stem: Stem) {
		this.#stem = stem;
	}

	forget(): void {
		this.#fresh = false;
	}

	read(blend: MaskBlend, gains: StemGains, length: number, whole: Float32Array): Float32Array {
		let values = this.#values;
		if (this.#fresh && values.length === length) return values;
		if (values.length !== length) values = this.#values = new Float32Array(length);
		const stem = this.#stem;
		const scale = (SabLayout.bins - 1) / max(1, length - 1);
		const gain = gains.of(stem);
		for (let index = 0; index < length; index++) values[index] = whole[index] * blend.sample(stem, index * scale) * gain;
		this.#fresh = true;
		return values;
	}
}
//#endregion
