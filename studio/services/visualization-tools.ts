"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { type AudiosetView } from "../models/visualization.js";

const { split, PI, exp, sqrt, asin, min, max, trunc } = Math;

//#region Shaper
export class Shaper {
	static #arcsinSaturate: Shaper = new Shaper(x => asin(sqrt(x)) * 2 / PI);
	static #smoothstep: Shaper = new Shaper(x => x * x * (3 - 2 * x));

	#callback: (x: number) => number;

	constructor(callback: (x: number) => number) {
		this.#callback = callback;
	}

	static get arcsinSaturate(): Shaper { return this.#arcsinSaturate; }
	static get smoothstep(): Shaper { return this.#smoothstep; }

	static sigmoid(steepness: number = 12, center: number = 0.5): Shaper {
		return new Shaper(x => 1 / (1 + exp(-(steepness * (x - center)))));
	}

	apply(value: number): number {
		return this.#callback(value);
	}

	then(next: Shaper): Shaper {
		const callback = this.#callback;
		return new Shaper(x => next.apply(callback(x)));
	}
}
//#endregion
//#region Color driver
export class ColorDriver {
	#offset: number = 0;

	tick(color: Color, rate: number, delta: number, factor: number = 1): void {
		if (!Number.isFinite(delta)) return;
		const [integer, fractional] = split(this.#offset + rate * delta * factor);
		color.rotate(integer);
		this.#offset = fractional;
	}
}
//#endregion
//#region Running range
/**
 * The quiet-to-loud range of one input in the song that is playing: its 5th and 95th percentiles
 * over the last ~30 seconds, sampled on the clock so the window is the same at any frame rate.
 * Until enough of the song has been heard it leans on a prior range (measured over MUSDB18HQ), and
 * the span never shrinks below a fraction of the prior span, so a quiet passage is not blown up into noise.
 */
class RunningRange {
	static #capacity: number = 256; // samples, ~32 s
	static #interval: number = 0.125; // s between samples
	static #refresh: number = 0.5; // s between percentile updates
	static #warmup: number = 40; // samples (~5 s) before the song's own range is fully trusted
	static #floor: number = 0.3; // minimum span, as a fraction of the prior span

	#prior: [number, number];
	#window: Float64Array = new Float64Array(RunningRange.#capacity);
	#sorted: Float64Array = new Float64Array(RunningRange.#capacity);
	#count: number = 0;
	#cursor: number = 0;
	#untilSample: number = 0;
	#untilRefresh: number = 0;
	#low: number;
	#high: number;

	constructor(prior: [number, number]) {
		this.#prior = prior;
		[this.#low, this.#high] = prior;
	}

	reset(): void {
		this.#count = 0;
		this.#cursor = 0;
		[this.#low, this.#high] = this.#prior;
	}

	push(value: number, delta: number): void {
		this.#untilSample -= delta;
		this.#untilRefresh -= delta;
		if (this.#untilSample <= 0) {
			const capacity = RunningRange.#capacity;
			const cursor = this.#cursor;
			this.#untilSample += RunningRange.#interval;
			this.#window[cursor] = value;
			this.#cursor = (cursor + 1) % capacity;
			this.#count = min(this.#count + 1, capacity);
		}
		if (this.#untilRefresh > 0) return;
		this.#untilRefresh += RunningRange.#refresh;
		this.#refit();
	}

	#refit(): void {
		const count = this.#count;
		if (count < 8) return;
		const sorted = this.#sorted.subarray(0, count);
		sorted.set(this.#window.subarray(0, count));
		sorted.sort();
		let low = sorted[trunc(count * 0.05)], high = sorted[min(count - 1, trunc(count * 0.95))];
		const [priorLow, priorHigh] = this.#prior;
		const floor = (priorHigh - priorLow) * RunningRange.#floor;
		if (high - low < floor) {
			const middle = (high + low) / 2;
			low = middle - floor / 2;
			high = middle + floor / 2;
		}
		const trust = min(1, count / RunningRange.#warmup);
		this.#low = priorLow + (low - priorLow) * trust;
		this.#high = priorHigh + (high - priorHigh) * trust;
	}

	/** `value` mapped from this range onto 0–`top`, clamped. */
	fit(value: number, top: number): number {
		const low = this.#low;
		const high = max(this.#high, low + 1e-9);
		return value.clamp(low, high).lerp(low, high, 0, top);
	}
}
//#endregion
//#region Drivers
/**
 * The inputs the built-in visualizations feed their effects, each taken from the source that best
 * follows the instrument the effect stands for, and fitted to the song that is playing so the effect
 * sweeps its whole designed range (the number after each name below) on a quiet ballad and on a loud
 * EDM master alike. A fixed fit pinned loud masters again: on one EDM track the envelope sat at its
 * maximum 81% of the time, the bloom 37%, the shake 29%.
 *
 * Sources were chosen by correlation with the true isolated instrument over MUSDB18HQ; the mix stays
 * where it measured better (beat timing, the bass band). Colour brightness is deliberately not driven
 * here: `illuminate()` turns a full-range input into white, so brightness keeps production's own scale.
 *
 * Call `update()` once per frame, before reading any driver.
 */
export class Drivers {
	static #silence: number = 0.01; // volume below which the music counts as stopped
	static #gap: number = 1.5; // s of silence that starts a fresh song
	static #tops: number[] = [0.5, 1, 0.6, 0.8, 0.45, 0.5, 0.6, 0.3, 1];

	#ranges: RunningRange[] = [
		new RunningRange([0.0455, 0.9471]), // drop
		new RunningRange([0.0259, 1]), // percussiveness
		new RunningRange([0.0240, 0.7524]), // bass level
		new RunningRange([0.0285, 0.8544]), // sub-bass
		new RunningRange([0.0930, 0.3115]), // centroid
		new RunningRange([0.0006, 0.2653]), // high
		new RunningRange([0.0071, 0.3011]), // high-mid
		new RunningRange([0.0010, 0.0202]), // flux
		new RunningRange([0.0355, 0.1996]), // volume
	];
	#sources: Float64Array = new Float64Array(9);
	#values: Float64Array = new Float64Array(9);
	#silent: number = 0;

	#watchSilence(volume: number, delta: number): void {
		if (volume >= Drivers.#silence) {
			this.#silent = 0;
			return;
		}
		const gap = Drivers.#gap;
		const before = this.#silent;
		const silent = this.#silent = before + delta;
		if (before >= gap || silent < gap) return;
		for (const range of this.#ranges) range.reset();
	}

	#readSources(audioset: AudiosetView): void {
		const { subBass, volume, stems } = audioset;
		const { drums, bass, vocals, other } = stems;
		const energy = vocals.energy + other.energy;
		const sources = this.#sources;
		sources[0] = min(1, drums.percussiveness * 3) * subBass;
		sources[1] = drums.percussiveness;
		sources[2] = bass.bassLevel;
		sources[3] = bass.subBass;
		let centroid = 0;
		if (energy > 0) centroid = (vocals.spectralCentroid * vocals.energy + other.spectralCentroid * other.energy) / energy;
		sources[4] = centroid;
		sources[5] = drums.high;
		sources[6] = drums.highMid;
		sources[7] = vocals.spectralFlux + other.spectralFlux;
		sources[8] = volume;
	}

	/** Reads this frame's sources and advances every running range; `delta` is the frame time in seconds. */
	update(audioset: AudiosetView, delta: number): void {
		if (!Number.isFinite(delta) || delta < 0) delta = 0;
		this.#watchSilence(audioset.volume, delta);
		this.#readSources(audioset);
		const ranges = this.#ranges, sources = this.#sources, values = this.#values, tops = Drivers.#tops;
		for (let index = 0; index < ranges.length; index++) {
			ranges[index].push(sources[index], delta);
			values[index] = ranges[index].fit(sources[index], tops[index]);
		}
	}

	/** Shake, 0–0.5: the drop formula with the drums thread's percussiveness — kicks shake the view, not bass notes. */
	get drop(): number { return this.#values[0]; }

	/** Pulse and wave punch, 0–1: the drums thread's percussiveness. */
	get percussiveness(): number { return this.#values[1]; }

	/** Glow, blur and bloom alpha, 0–0.6: the bass thread's bass level — the glow follows the bass line, not the kick. */
	get bassLevel(): number { return this.#values[2]; }

	/** Bloom radius, 0–0.8: the bass thread's sub-bass band. */
	get subBass(): number { return this.#values[3]; }

	/** Hue, 0–0.45: the melody's (vocals + other) energy-weighted centroid — hi-hats stop pulling the hue. */
	get centroid(): number { return this.#values[4]; }

	/** Sparkle, 0–0.5: the drums thread's high band — cymbals and hats. */
	get high(): number { return this.#values[5]; }

	/** Sparkle, 0–0.6: the drums thread's high-mid band. */
	get highMid(): number { return this.#values[6]; }

	/** Shimmer, 0–0.3: the melody's (vocals + other) spectral flux — how much the tune itself is changing. */
	get flux(): number { return this.#values[7]; }

	/** Loudness for size ranges (the envelope), 0–1. Never for brightness, never as a raw multiplier. */
	get volume(): number { return this.#values[8]; }
}
//#endregion
//#region Silhouette
/**
 * The spectrum a silhouette is drawn from, rebuilt from the four threads: every thread at full weight
 * except drums, which are reduced so hi-hats and snares stop jagging the shape (the drums still move
 * the picture through the camera). A gain lets the shape's peaks reach the mix's own height; the
 * buffer is reused frame to frame.
 */
export class Silhouette {
	#weightDrums: number;
	#gain: number;
	#spectrum: Float32Array = new Float32Array(0);

	constructor(weightDrums: number, gain: number) {
		this.#weightDrums = weightDrums;
		this.#gain = gain;
	}

	shape(audioset: AudiosetView): Float32Array {
		const whole = audioset.dataFrequency;
		const drums = audioset.stems.drums.dataFrequency;
		const { length } = whole;
		let spectrum = this.#spectrum;
		if (spectrum.length !== length) spectrum = this.#spectrum = new Float32Array(length);
		const reduction = 1 - this.#weightDrums, gain = this.#gain;
		for (let index = 0; index < length; index++) spectrum[index] = min(1, (whole[index] - drums[index] * reduction) * gain);
		return spectrum;
	}
}
//#endregion
