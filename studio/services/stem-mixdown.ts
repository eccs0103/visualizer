"use strict";

import "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";
import { Stems } from "../models/stem.js";
import { type StemGains } from "../models/stem-gains.js";
import { type MaskBlend } from "./mask-blend.js";

const { max } = Math;

//#region Stem mixdown
export class StemMixdown {
	#values: Float32Array = new Float32Array(0);
	#level: number = 1;
	#fresh: boolean = false;

	forget(): void {
		this.#fresh = false;
	}

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
		this.#level = sum2 > 0 ? sum / sum2 : 1;
		this.#fresh = true;
		return values;
	}

	level(blend: MaskBlend, gains: StemGains, length: number, whole: Float32Array): number {
		this.read(blend, gains, length, whole);
		return this.#level;
	}
}
//#endregion
