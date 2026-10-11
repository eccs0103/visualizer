"use strict";

import "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";
import { Stems } from "../models/stem.js";
import { type StemGains } from "../models/stem-gains.js";
import { type MaskBlend } from "./mask-blend.js";

const { max } = Math;

//#region Stem mixdown
/** The whole spectrum as the sum of the six stems at their gains, and how much of the whole it keeps. Built on first read and kept until `forget`. */
export class StemMixdown {
	#values: Float32Array = new Float32Array(0);
	#level: number = 1;
	#fresh: boolean = false;

	forget(): void {
		this.#fresh = false;
	}

	/** Per bin `whole × Σ(gain × mask) / Σ mask`. At every gain 1 the quotient is exactly 1, so it is `whole` bit for bit. */
	read(blend: MaskBlend, gains: StemGains, length: number, whole: Float32Array): Float32Array {
		let values = this.#values;
		if (this.#fresh && values.length === length) return values;
		if (values.length !== length) values = this.#values = new Float32Array(length);
		const stems = Stems.all;
		const factors = stems.map(stem => gains.of(stem));
		const scale = (SabLayout.bins - 1) / max(1, length - 1);
		let sum = 0, sum2 = 0;
		for (let index = 0; index < length; index++) {
			const position = index * scale;
			let weighted = 0, total = 0;
			for (let stem = 0; stem < stems.length; stem++) {
				const mask = blend.sample(stems[stem], position);
				weighted += factors[stem] * mask;
				total += mask;
			}
			const value = total > 0 ? whole[index] * (weighted / total) : 0;
			values[index] = value;
			sum += value;
			sum2 += whole[index];
		}
		this.#level = sum2 > 0 ? sum / sum2 : 1; // a silent spectrum has nothing to weigh
		this.#fresh = true;
		return values;
	}

	/** How much of the whole spectrum the gains keep: `Σ mixdown / Σ whole` (1 at every gain 1, 0 at every gain 0); for the signals the masks can't split, like the waveform. */
	level(blend: MaskBlend, gains: StemGains, length: number, whole: Float32Array): number {
		this.read(blend, gains, length, whole);
		return this.#level;
	}
}
//#endregion
