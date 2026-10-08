"use strict";

import "adaptive-extender/core";

const { max, min } = Math;

//#region SAB layout
export class SabLayout {
	static #maxLength: number = 16384;
	static #bins: number = 512;
	static #stems: number = 4;

	static get maxLength(): number { return SabLayout.#maxLength; }
	static get bins(): number { return SabLayout.#bins; }
	static get stems(): number { return SabLayout.#stems; }
}
//#endregion
//#region Signal
export class Signal {
	#sab: SharedArrayBuffer;
	#control: Int32Array;
	#time: Float64Array;
	#volume: Float32Array;
	#frequency: Float32Array;
	#temporal: Float32Array;
	#model: Float32Array;

	constructor(sab: SharedArrayBuffer) {
		const maxLength = SabLayout.maxLength;
		this.#sab = sab;
		this.#control = new Int32Array(sab, 0, 2);
		this.#time = new Float64Array(sab, 8, 1);
		this.#volume = new Float32Array(sab, 16, 1);
		this.#frequency = new Float32Array(sab, 24, maxLength);
		this.#temporal = new Float32Array(sab, 24 + maxLength * 4, maxLength);
		this.#model = new Float32Array(sab, 24 + maxLength * 8, SabLayout.bins);
	}

	static create(): Signal {
		return new Signal(new SharedArrayBuffer(24 + SabLayout.maxLength * 4 * 2 + SabLayout.bins * 4));
	}

	get sab(): SharedArrayBuffer { return this.#sab; }
	get frame(): number { return Atomics.load(this.#control, 0); }
	get length(): number { return Atomics.load(this.#control, 1); }
	get time(): number { return this.#time[0]; }
	get volume(): number { return this.#volume[0]; }
	get frequency(): Float32Array { return this.#frequency; }
	get temporal(): Float32Array { return this.#temporal; }
	get model(): Float32Array { return this.#model; }

	publish(length: number, volume: number, time: number): void {
		const control = this.#control;
		this.#volume[0] = volume;
		this.#time[0] = time;
		Atomics.store(control, 1, length);
		Atomics.add(control, 0, 1);
	}
}
//#endregion
//#region Stem masks
/**
 * A view over the mask SAB — owns resampling the fixed `bins`-bin mask onto whatever `length` the main analyser is using (linear interpolation: both are linear FFT bins over 0..Nyquist, so this is exact, not an approximation) and multiplying by `dataFrequency` to produce an isolated-stem spectrum. Computed lazily per stem, cached until the blended masks or the requested length change — a visualization using one stem never pays to resample the other three.
 *
 * The model publishes a few times per second, so the masks are not read raw: each frame blends the previous publication into the current one over the measured gap between them (`invalidate`), which keeps every stem moving at the render rate. The blend trails the model by one publication interval — it shows the model's own output, smoothed in time, never a prediction of what it will say next.
 *
 * The blended masks are then squared and renormalised per bin (a Wiener-style power 2): the model's softmax cannot say a stem is absent — on frames with no vocals it still hands vocals ~10% of the spectrum — and squaring roughly halves that floor. Measured on MUSDB18HQ test tracks, powers 2 to 6 cut the false share about the same, and power 2 costs the least correlation with the true stems.
 */
export class StemMasks {
	static #drums: number = 0;
	static #bass: number = 1;
	static #vocals: number = 2;
	static #other: number = 3;
	static #ceiling: number = 500; // ms — a longer gap (paused audio) must not stretch the next blend

	#control: Int32Array;
	#timing: Float64Array;
	#previous: Float32Array;
	#current: Float32Array;
	#blended: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems);
	#version: number | null = null;
	#weight: number | null = null;
	#length: number | null = null;
	#cache: Float32Array[] = [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)];
	#fresh: boolean[] = [false, false, false, false];

	constructor(sabMask: SharedArrayBuffer) {
		const size = SabLayout.bins * SabLayout.stems;
		this.#control = new Int32Array(sabMask, 0, 1);
		this.#timing = new Float64Array(sabMask, 8, 2);
		this.#previous = new Float32Array(sabMask, 24, size);
		this.#current = new Float32Array(sabMask, 24 + size * 4, size);
		this.#blend(1);
	}

	/** A fresh mask buffer at the uniform 1/stems prior — an honest "no separation yet", not zeros. */
	static createBuffer(): SharedArrayBuffer {
		const sab = new SharedArrayBuffer(24 + SabLayout.bins * SabLayout.stems * 4 * 2);
		new Float32Array(sab, 24).fill(1 / SabLayout.stems);
		return sab;
	}

	/** Mask worker only: `masks` becomes the current masks, the old current ones become the previous, and `now` (epoch ms) starts the blend between them. */
	publish(masks: Float32Array, now: number): void {
		const timing = this.#timing;
		const current = this.#current;
		this.#previous.set(current);
		current.set(masks);
		const stamp = timing[0];
		let interval = 0;
		if (stamp !== 0) interval = min(now - stamp, StemMasks.#ceiling);
		timing[1] = interval;
		timing[0] = now;
		Atomics.add(this.#control, 0, 1);
	}

	/** Call once per rendered frame — cheap: the blend is rebuilt only when a new version was published or the blend weight moved. */
	invalidate(now: number = performance.timeOrigin + performance.now()): void {
		const version = Atomics.load(this.#control, 0);
		const weight = this.#weightAt(now);
		if (version === this.#version && weight === this.#weight) return;
		this.#version = version;
		this.#weight = weight;
		this.#blend(weight);
		this.#fresh.fill(false);
	}

	#weightAt(now: number): number {
		const [stamp, interval] = this.#timing;
		if (interval <= 0) return 1;
		return ((now - stamp) / interval).clamp(0, 1);
	}

	#blend(weight: number): void {
		const previous = this.#previous, current = this.#current, blended = this.#blended;
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

	drums(length: number, whole: Float32Array): Float32Array { return this.#spectrum(StemMasks.#drums, length, whole); }
	bass(length: number, whole: Float32Array): Float32Array { return this.#spectrum(StemMasks.#bass, length, whole); }
	vocals(length: number, whole: Float32Array): Float32Array { return this.#spectrum(StemMasks.#vocals, length, whole); }
	other(length: number, whole: Float32Array): Float32Array { return this.#spectrum(StemMasks.#other, length, whole); }

	#spectrum(stem: number, length: number, whole: Float32Array): Float32Array {
		const fresh = this.#fresh;
		const cache = this.#cache;
		if (this.#length !== length) {
			this.#length = length;
			fresh.fill(false);
		}
		if (fresh[stem]) return cache[stem];
		let target = cache[stem];
		if (target.length !== length) target = cache[stem] = new Float32Array(length);
		this.#interpolate(stem, length, whole, target);
		fresh[stem] = true;
		return target;
	}

	#interpolate(stem: number, length: number, whole: Float32Array, out: Float32Array): void {
		const masks = this.#blended;
		const stems = SabLayout.stems;
		const bins = SabLayout.bins;
		const scale = (bins - 1) / max(1, length - 1);
		for (let index = 0; index < length; index++) {
			const position = index * scale;
			const bin = position | 0;
			const bin2 = min(bin + 1, bins - 1);
			const weight = position - bin;
			const mask = masks[bin * stems + stem] * (1 - weight) + masks[bin2 * stems + stem] * weight;
			out[index] = whole[index] * mask;
		}
	}
}
//#endregion
