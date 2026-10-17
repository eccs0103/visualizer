"use strict";

import "adaptive-extender/worker";
import { SabLayout, MaskChannel } from "../models/audio-features.js";
import { Stems, StemGains, type Stem } from "../models/stem.js";

const { min, max } = Math;

//#region Mask blend
class MaskBlend {
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
//#region Stem frame
export class StemFrame {
	#blend: MaskBlend;
	#gains: StemGains = StemGains.unit;
	#whole: Float32Array = new Float32Array(0);
	#temporal: Float32Array = new Float32Array(0);
	#spectra: Map<Stem, Float32Array> = new Map();
	#fresh: Set<Stem> = new Set();
	#mix: Float32Array = new Float32Array(0);
	#level: number = 1;
	#mixed: boolean = false;
	#waveform: Float32Array = new Float32Array(0);
	#shaped: number | null = null;

	constructor(sabMask: SharedArrayBuffer) {
		this.#blend = new MaskBlend(new MaskChannel(sabMask));
		const spectra = this.#spectra;
		for (const stem of Stems.all) spectra.set(stem, new Float32Array(0));
	}

	get mix(): Float32Array { return this.#mixdown(); }

	get level(): number {
		this.#mixdown();
		return this.#level;
	}

	get waveform(): Float32Array {
		const level = this.level;
		let values = this.#waveform;
		if (level === this.#shaped) return values;
		this.#shaped = level;
		const temporal = this.#temporal;
		const { length } = temporal;
		if (values.length !== length) values = this.#waveform = new Float32Array(length);
		const center = 0.5 * (1 - level);
		for (let index = 0; index < length; index++) values[index] = temporal[index] * level + center;
		return values;
	}

	spectrum(stem: Stem): Float32Array {
		const spectra = this.#spectra;
		const fresh = this.#fresh;
		let values = spectra.get(stem);
		if (values === undefined) throw new ReferenceError(`No spectrum for the '${stem}' stem`);
		if (fresh.has(stem)) return values;
		const whole = this.#whole;
		const { length } = whole;
		if (values.length !== length) {
			values = new Float32Array(length);
			spectra.set(stem, values);
		}
		const blend = this.#blend;
		const scale = (SabLayout.bins - 1) / max(1, length - 1);
		const gain = this.#gains.of(stem);
		for (let index = 0; index < length; index++) values[index] = whole[index] * blend.sample(stem, index * scale) * gain;
		fresh.add(stem);
		return values;
	}

	invalidate(now: number = performance.timeOrigin + performance.now()): void {
		if (this.#blend.refresh(now)) this.#forget();
	}

	load(whole: Float32Array, temporal: Float32Array): void {
		this.#whole = whole;
		this.#temporal = temporal;
		this.#shaped = null;
		this.#forget();
	}

	weigh(gains: StemGains): void {
		this.#gains = gains;
		this.#forget();
	}

	#mixdown(): Float32Array {
		let values = this.#mix;
		if (this.#mixed) return values;
		const whole = this.#whole;
		const { length } = whole;
		if (values.length !== length) values = this.#mix = new Float32Array(length);
		const blend = this.#blend;
		const gains = this.#gains;
		const stems = Stems.all;
		const factors = stems.map(stem => gains.of(stem));
		this.#mixed = true;
		if (factors.every(factor => factor === 1)) {
			values.set(whole);
			this.#level = 1;
			return values;
		}
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
		return values;
	}

	#forget(): void {
		this.#fresh.clear();
		this.#mixed = false;
	}
}
//#endregion
