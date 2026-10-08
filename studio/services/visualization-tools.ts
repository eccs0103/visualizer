"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";
import { type Audioset } from "../models/visualization.js";

const { split, PI, exp, sqrt, asin, min, max, round, trunc } = Math;

//#region Shaper
export interface Curve {
	(x: number): number;
}

export class Shaper {
	static #arcsinSaturate: Shaper = new Shaper(x => asin(sqrt(x)) * 2 / PI);
	static #smoothstep: Shaper = new Shaper(x => x * x * (3 - 2 * x));

	#callback: Curve;

	constructor(callback: Curve) {
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
//#region Hue drift
export class HueDrift {
	#offset: number = 0;

	tick(color: Color, rate: number, delta: number, factor: number = 1): void {
		if (!Number.isFinite(delta)) return;
		const [integer, fractional] = split(this.#offset + rate * delta * factor);
		color.rotate(integer);
		this.#offset = fractional;
	}
}
//#endregion
//#region Stem mix
export class StemMix {
	#drums: number;
	#bass: number;
	#vocals: number;
	#guitar: number;
	#keys: number;
	#other: number;
	#gain: number;
	#spectrum: Float32Array = new Float32Array(0);

	constructor(drums: number, bass: number, vocals: number, guitar: number, keys: number, other: number, gain: number) {
		this.#drums = drums;
		this.#bass = bass;
		this.#vocals = vocals;
		this.#guitar = guitar;
		this.#keys = keys;
		this.#other = other;
		this.#gain = gain;
	}

	mix(audioset: Audioset): Float32Array {
		const whole = audioset.dataFrequency;
		const drums = audioset.dataDrums;
		const bass = audioset.dataBass;
		const vocals = audioset.dataVocals;
		const guitar = audioset.dataGuitar;
		const keys = audioset.dataKeys;
		const other = audioset.dataOther;
		const { length } = whole;
		let spectrum = this.#spectrum;
		if (spectrum.length !== length) spectrum = this.#spectrum = new Float32Array(length);
		const cutDrums = 1 - this.#drums;
		const cutBass = 1 - this.#bass;
		const cutVocals = 1 - this.#vocals;
		const cutGuitar = 1 - this.#guitar;
		const cutKeys = 1 - this.#keys;
		const cutOther = 1 - this.#other;
		const gain = this.#gain;
		for (let index = 0; index < length; index++) {
			const rest = whole[index] - drums[index] * cutDrums - bass[index] * cutBass - vocals[index] * cutVocals - guitar[index] * cutGuitar - keys[index] * cutKeys - other[index] * cutOther;
			spectrum[index] = min(1, rest * gain);
		}
		return spectrum;
	}
}
//#endregion
//#region Spectrum analysis
class FluxStats {
	#mean: number;
	#standardDeviation: number;

	constructor(mean: number, standardDeviation: number) {
		this.#mean = mean;
		this.#standardDeviation = standardDeviation;
	}

	get mean(): number { return this.#mean; }

	onsetThreshold(multiplier: number): number {
		return this.#mean + multiplier * this.#standardDeviation;
	}
}

export class SpectrumAnalysis {
	static #capacity: number = 1280;
	static #multiplier: number = 1.5;
	static #window: number = 63.5 / 60 * 1000;
	static #gap: number = 3.5 / 60 * 1000;

	#previous: Float32Array = new Float32Array(SabLayout.maxLength);
	#fluxHistory: Float32Array = new Float32Array(SpectrumAnalysis.#capacity);
	#timeHistory: Float64Array = new Float64Array(SpectrumAnalysis.#capacity);
	#fluxCursor: number = 0;
	#lastBeat: number = -Infinity;
	#bins: [number, number][] | null = null;
	#cachedLength: number = 0;
	#cachedSampleRate: number = 0;
	#time: number | null = null;
	#values: Float32Array = new Float32Array(12);

	get spectralFlux(): number { return this.#values[0]; }
	get subBass(): number { return this.#values[1]; }
	get bass(): number { return this.#values[2]; }
	get lowMid(): number { return this.#values[3]; }
	get mid(): number { return this.#values[4]; }
	get highMid(): number { return this.#values[5]; }
	get high(): number { return this.#values[6]; }
	get spectralCentroid(): number { return this.#values[7]; }
	get percussiveness(): number { return this.#values[8]; }
	get beatDetected(): boolean { return this.#values[9] > 0.5; }
	get dropIntensity(): number { return this.#values[10]; }
	get bassLevel(): number { return this.#values[11]; }

	get energy(): number {
		const values = this.#values;
		return values[1] + values[2] + values[3] + values[4] + values[5] + values[6];
	}

	#computeBins(length: number, sampleRate: number): [number, number][] {
		const binWidth = (sampleRate / 2) / length;
		const bands: [number, number][] = [
			[20, 60],
			[60, 250],
			[250, 500],
			[500, 2000],
			[2000, 6000],
			[6000, 20000],
		];
		return bands.map(([low, high]) => [
			max(0, round(low / binWidth)),
			min(length - 1, round(high / binWidth)),
		]);
	}

	#obtainBins(length: number, sampleRate: number): [number, number][] {
		const bins = this.#bins;
		if (bins !== null && length === this.#cachedLength && sampleRate === this.#cachedSampleRate) return bins;
		this.#cachedLength = length;
		this.#cachedSampleRate = sampleRate;
		return this.#bins = this.#computeBins(length, sampleRate);
	}

	#computeSpectralFlux(frequency: ArrayLike<number>, length: number, time: number): number {
		const previous = this.#previous;
		const capacity = SpectrumAnalysis.#capacity;
		const cursor = this.#fluxCursor;
		let flux = 0;
		for (let binIndex = 0; binIndex < length; binIndex++) {
			const diff = frequency[binIndex] - previous[binIndex];
			if (diff > 0) flux += diff;
		}
		flux /= length;
		previous.set(frequency);
		this.#fluxHistory[cursor % capacity] = flux;
		this.#timeHistory[cursor % capacity] = time;
		this.#fluxCursor = cursor + 1;
		return flux;
	}

	#computeBandEnergies(frequency: ArrayLike<number>, bins: [number, number][]): Float32Array {
		const energies = new Float32Array(6);
		for (let bandIndex = 0; bandIndex < 6; bandIndex++) {
			const [low, high] = bins[bandIndex];
			if (low >= high) continue;
			let sum = 0;
			for (let binIndex = low; binIndex <= high; binIndex++) sum += frequency[binIndex];
			energies[bandIndex] = sum / (high - low + 1);
		}
		return energies;
	}

	#computeSpectralCentroid(frequency: ArrayLike<number>, length: number): number {
		let sumWeighted = 0, sumEnergy = 0;
		for (let binIndex = 0; binIndex < length; binIndex++) {
			sumWeighted += frequency[binIndex] * binIndex;
			sumEnergy += frequency[binIndex];
		}
		if (sumEnergy > 0.001) return sumWeighted / (sumEnergy * length);
		return 0;
	}

	#computeFluxStats(time: number): FluxStats {
		const fluxHistory = this.#fluxHistory;
		const timeHistory = this.#timeHistory;
		const filled = min(this.#fluxCursor, SpectrumAnalysis.#capacity);
		const window = SpectrumAnalysis.#window;
		let mean = 0, count = 0;
		for (let index = 0; index < filled; index++) {
			if (time - timeHistory[index] >= window) continue;
			mean += fluxHistory[index];
			count++;
		}
		mean /= max(1, count);
		let variance = 0;
		for (let index = 0; index < filled; index++) {
			if (time - timeHistory[index] >= window) continue;
			const diff = fluxHistory[index] - mean;
			variance += diff * diff;
		}
		return new FluxStats(mean, sqrt(variance / max(1, count)));
	}

	#detectBeat(flux: number, stats: FluxStats, time: number): boolean {
		const detected = flux > stats.onsetThreshold(SpectrumAnalysis.#multiplier) && time - this.#lastBeat >= SpectrumAnalysis.#gap;
		if (detected) this.#lastBeat = time;
		return detected;
	}

	analyze(spectrum: ArrayLike<number>, audioset: Audioset): void {
		const { time, length, sampleRate } = audioset;
		if (time === this.#time) return;
		this.#time = time;
		if (length === 0) return;

		const bins = this.#obtainBins(length, sampleRate);
		const flux = this.#computeSpectralFlux(spectrum, length, time);
		const bandEnergies = this.#computeBandEnergies(spectrum, bins);
		const centroid = this.#computeSpectralCentroid(spectrum, length);

		const fluxStats = this.#computeFluxStats(time);
		const percussiveness = min(1, flux / (fluxStats.mean + 0.001));
		const beatDetected = this.#detectBeat(flux, fluxStats, time);

		const values = this.#values;
		values[0] = flux;
		for (let bandIndex = 0; bandIndex < 6; bandIndex++) values[1 + bandIndex] = bandEnergies[bandIndex];
		values[7] = centroid;
		values[8] = percussiveness;
		values[9] = Number(beatDetected);
		values[10] = min(1, percussiveness * 3) * bandEnergies[0];
		values[11] = bandEnergies[0] * 0.4 + bandEnergies[1] * 0.6;
	}
}
//#endregion
//#region Auto range
/**
 * The quiet-to-loud range of one input in the song that is playing: its 5th and 95th percentiles over the last ~30 seconds, sampled on the clock so the window is the same at any frame rate. Until enough of the song has been heard it leans on a prior range (measured over MUSDB18HQ), and the span never shrinks below a fraction of the prior span, so a quiet passage is not blown up into noise.
 */
export class AutoRange {
	static #capacity: number = 256; // samples, ~32 s
	static #interval: number = 0.125; // s between samples
	static #refresh: number = 0.5; // s between percentile updates
	static #warmup: number = 40; // samples (~5 s) before the song's own range is fully trusted
	static #floor: number = 0.3; // minimum span, as a fraction of the prior span
	static #silence: number = 0.01; // volume below which the music counts as stopped
	static #gap: number = 1.5; // s of silence that starts a fresh song

	#lowPrior: number;
	#highPrior: number;
	#window: Float64Array = new Float64Array(AutoRange.#capacity);
	#sorted: Float64Array = new Float64Array(AutoRange.#capacity);
	#count: number = 0;
	#cursor: number = 0;
	#untilSample: number = 0;
	#untilRefresh: number = 0;
	#silent: number = 0;
	#low: number;
	#high: number;
	#level: number = 0;

	constructor(low: number, high: number) {
		this.#lowPrior = low;
		this.#highPrior = high;
		this.#low = low;
		this.#high = high;
	}

	get level(): number { return this.#level; }

	#reset(): void {
		this.#count = 0;
		this.#cursor = 0;
		this.#low = this.#lowPrior;
		this.#high = this.#highPrior;
	}

	#watchSilence(volume: number, delta: number): void {
		if (volume >= AutoRange.#silence) {
			this.#silent = 0;
			return;
		}
		const gap = AutoRange.#gap;
		const before = this.#silent;
		const silent = this.#silent = before + delta;
		if (before >= gap || silent < gap) return;
		this.#reset();
	}

	#sample(value: number, delta: number): void {
		this.#untilSample -= delta;
		this.#untilRefresh -= delta;
		if (this.#untilSample <= 0) {
			const capacity = AutoRange.#capacity;
			const cursor = this.#cursor;
			this.#untilSample += AutoRange.#interval;
			this.#window[cursor] = value;
			this.#cursor = (cursor + 1) % capacity;
			this.#count = min(this.#count + 1, capacity);
		}
		if (this.#untilRefresh > 0) return;
		this.#untilRefresh += AutoRange.#refresh;
		this.#refit();
	}

	#refit(): void {
		const count = this.#count;
		if (count < 8) return;
		const sorted = this.#sorted.subarray(0, count);
		sorted.set(this.#window.subarray(0, count));
		sorted.sort();
		let low = sorted[trunc(count * 0.05)], high = sorted[min(count - 1, trunc(count * 0.95))];
		const lowPrior = this.#lowPrior;
		const highPrior = this.#highPrior;
		const floor = (highPrior - lowPrior) * AutoRange.#floor;
		if (high - low < floor) {
			const middle = (high + low) / 2;
			low = middle - floor / 2;
			high = middle + floor / 2;
		}
		const trust = min(1, count / AutoRange.#warmup);
		this.#low = lowPrior + (low - lowPrior) * trust;
		this.#high = highPrior + (high - highPrior) * trust;
	}

	push(value: number, volume: number, delta: number): void {
		if (!Number.isFinite(delta) || delta < 0) delta = 0;
		this.#watchSilence(volume, delta);
		this.#sample(value, delta);
		const low = this.#low;
		const high = max(this.#high, low + 1e-9);
		this.#level = value.clamp(low, high).lerp(low, high, 0, 1);
	}
}
//#endregion
