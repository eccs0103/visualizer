"use strict";

import "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";
import { type Stem } from "../models/stem.js";
import { type MaskChannel } from "./mask-channel.js";

const { min } = Math;

//#region Mask blend
export class MaskBlend {
	#channel: MaskChannel;
	#blended: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems);
	#version: number | null = null;
	#weight: number | null = null;

	constructor(channel: MaskChannel) {
		this.#channel = channel;
		this.#blend(1);
	}

	refresh(now: number): boolean {
		const channel = this.#channel;
		const version = channel.version;
		const weight = channel.weight(now);
		if (version === this.#version && weight === this.#weight) return false;
		this.#version = version;
		this.#weight = weight;
		this.#blend(weight);
		return true;
	}

	sample(stem: Stem, position: number): number {
		const masks = this.#blended;
		const stems = SabLayout.stems;
		const bin = position | 0;
		const bin2 = min(bin + 1, SabLayout.bins - 1);
		const weight = position - bin;
		return masks[bin * stems + stem] * (1 - weight) + masks[bin2 * stems + stem] * weight;
	}

	#blend(weight: number): void {
		const { previous, current } = this.#channel;
		const blended = this.#blended;
		const stems = SabLayout.stems;
		for (let bin = 0; bin < SabLayout.bins; bin++) {
			const base = bin * stems;
			let sum = 1e-12;
			for (let stem = 0; stem < stems; stem++) {
				const mask = previous[base + stem] + (current[base + stem] - previous[base + stem]) * weight;
				// Power 2: on MUSDB18HQ powers 2 to 6 cut the share of absent stems alike, and 2 costs the least correlation with the true stems.
				blended[base + stem] = mask * mask;
				sum += mask * mask;
			}
			for (let stem = 0; stem < stems; stem++) blended[base + stem] /= sum;
		}
	}
}
//#endregion
