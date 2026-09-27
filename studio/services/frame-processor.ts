"use strict";

import "adaptive-extender/worker";
import { SabLayout } from "../models/audio-features.js";

const { max, round, min, sqrt } = Math;

//#region Flux stats
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
//#endregion
//#region Frame processor
export class FrameProcessor {
	static #capacity: number = 1280;
	static #multiplier: number = 1.5;
	static #window: number = 63.5 / 60 * 1000;
	static #gap: number = 3.5 / 60 * 1000;

	#prevFrequency: Float32Array = new Float32Array(SabLayout.maxLength);
	#fluxHistory: Float32Array = new Float32Array(FrameProcessor.#capacity);
	#timeHistory: Float64Array = new Float64Array(FrameProcessor.#capacity);
	#fluxCursor: number = 0;
	#lastBeat: number = -Infinity;

	#bins: [number, number][] | null = null;
	#cachedLength: number = 0;
	#cachedSampleRate: number = 0;

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

	#computeSpectralFlux(frequency: Float32Array, length: number, time: number): number {
		const prevFrequency = this.#prevFrequency;
		const capacity = FrameProcessor.#capacity;
		const cursor = this.#fluxCursor;
		let flux = 0;
		for (let binIndex = 0; binIndex < length; binIndex++) {
			const diff = frequency[binIndex] - prevFrequency[binIndex];
			if (diff > 0) flux += diff;
		}
		flux /= length;
		prevFrequency.set(frequency);
		this.#fluxHistory[cursor % capacity] = flux;
		this.#timeHistory[cursor % capacity] = time;
		this.#fluxCursor = cursor + 1;
		return flux;
	}

	#computeBandEnergies(frequency: Float32Array): Float32Array {
		const energies = new Float32Array(6);
		const bins = this.#bins!;
		for (let bandIndex = 0; bandIndex < 6; bandIndex++) {
			const [low, high] = bins[bandIndex];
			if (low >= high) continue;
			let sum = 0;
			for (let binIndex = low; binIndex <= high; binIndex++) sum += frequency[binIndex];
			energies[bandIndex] = sum / (high - low + 1);
		}
		return energies;
	}

	#computeSpectralCentroid(frequency: Float32Array, length: number): number {
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
		const filled = min(this.#fluxCursor, FrameProcessor.#capacity);
		const window = FrameProcessor.#window;
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
		const detected = flux > stats.onsetThreshold(FrameProcessor.#multiplier) && time - this.#lastBeat >= FrameProcessor.#gap;
		if (detected) this.#lastBeat = time;
		return detected;
	}

	process(length: number, sampleRate: number, time: number, frequency: Float32Array, output: Float32Array): void {
		if (this.#bins === null || length !== this.#cachedLength || sampleRate !== this.#cachedSampleRate) {
			this.#bins = this.#computeBins(length, sampleRate);
			this.#cachedLength = length;
			this.#cachedSampleRate = sampleRate;
		}

		const sliceFrequency = frequency.subarray(0, length);
		const flux = this.#computeSpectralFlux(sliceFrequency, length, time);
		const bandEnergies = this.#computeBandEnergies(sliceFrequency);
		const centroid = this.#computeSpectralCentroid(sliceFrequency, length);

		const fluxStats = this.#computeFluxStats(time);
		const percussiveness = min(1, flux / (fluxStats.mean + 0.001));
		const beatDetected = this.#detectBeat(flux, fluxStats, time);

		output[0] = flux;
		for (let bandIndex = 0; bandIndex < 6; bandIndex++) output[1 + bandIndex] = bandEnergies[bandIndex];
		output[7] = centroid;
		output[8] = percussiveness;
		output[9] = Number(beatDetected);
		output[10] = min(1, percussiveness * 3) * bandEnergies[0];
		output[11] = bandEnergies[0] * 0.4 + bandEnergies[1] * 0.6;
	}
}
//#endregion
