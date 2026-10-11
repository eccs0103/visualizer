"use strict";

import "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";
import { type Stem } from "../models/stem.js";
import { type MaskChannel } from "./mask-channel.js";

const { min } = Math;

//#region Mask blend
/**
 * The masks the render side reads. The model publishes a few times per second, so the masks are not read raw: each frame blends the previous publication into the current one over the measured gap between them, which keeps every stem moving at the render rate. The blend trails the model by one publication interval — it shows the model's own output, smoothed in time, never a prediction of what it will say next.
 *
 * The blended masks are then squared and renormalised per bin (a Wiener-style power 2): the model's softmax cannot say a stem is absent — on frames with no vocals it still hands vocals ~10% of the spectrum — and squaring roughly halves that floor. Measured on MUSDB18HQ test tracks, powers 2 to 6 cut the false share about the same, and power 2 costs the least correlation with the true stems.
 */
export class MaskBlend {
	#channel: MaskChannel;
	#blended: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems);
	#version: number | null = null;
	#weight: number | null = null;

	constructor(channel: MaskChannel) {
		this.#channel = channel;
		this.#blend(1);
	}

	/** Re-blends when a new publication arrived or the blend moved on by `now` (epoch ms); returns whether the masks changed. */
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

	/** The mask of `stem` at a fractional bin `position`, linearly interpolated between its two neighbouring bins. */
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
				blended[base + stem] = mask * mask;
				sum += mask * mask;
			}
			for (let stem = 0; stem < stems; stem++) blended[base + stem] /= sum;
		}
	}
}
//#endregion
