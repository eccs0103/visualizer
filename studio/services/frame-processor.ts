"use strict";

import "adaptive-extender/worker";
import { SabLayout } from "../models/audio-features.js";
import { type Calibration } from "../models/calibration.js";

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
	get standardDeviation(): number { return this.#standardDeviation; }

	onsetThreshold(multiplier: number): number {
		return this.#mean + multiplier * this.#standardDeviation;
	}
}
//#endregion
//#region Frame processor
/** The audio analysis every plugin reads: writes output slots [0–14]. The DJ (slots [15–20]) lives in `DjPilot`. */
export class FrameProcessor {
	static #capacity: number = 128;

	#prevFrequency: Float32Array = new Float32Array(SabLayout.inputMaxLength);
	#fluxHistory: Float32Array = new Float32Array(FrameProcessor.#capacity);
	#fluxCursor: number = 0;
	#lastFrame: number = -1;
	#beatGap: number = 8;

	#bins: [number, number][] | null = null;
	#cachedLength: number = 0;
	#cachedSampleRate: number = 0;

	// Beat-detector constants — defaults match the pre-calibration behavior;
	// overwritten by loadCalibration() once resources/data/calibration.json arrives.
	#multiplier: number = 1.5;
	#minGap: number = 8;
	#window: number = 43;

	loadCalibration(calibration: Calibration): void {
		this.#multiplier = calibration.multiplier;
		this.#minGap = calibration.minGap;
		this.#window = min(calibration.window, FrameProcessor.#capacity);
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

	#computeSpectralFlux(frequency: Float32Array, length: number): number {
		const prevFrequency = this.#prevFrequency;
		let flux = 0;
		for (let binIndex = 0; binIndex < length; binIndex++) {
			const diff = frequency[binIndex] - prevFrequency[binIndex];
			if (diff > 0) flux += diff;
		}
		flux /= length;
		prevFrequency.set(frequency);
		this.#fluxHistory[this.#fluxCursor % this.#window] = flux;
		this.#fluxCursor++;
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

	#computeZeroCrossingRate(temporal: Float32Array, length: number): number {
		let crossings = 0;
		for (let sampleIndex = 1; sampleIndex < length; sampleIndex++) {
			const previous = temporal[sampleIndex - 1] - 0.5;
			const current = temporal[sampleIndex] - 0.5;
			if ((previous >= 0) !== (current >= 0)) crossings++;
		}
		return crossings / length;
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

	#computeFluxStats(): FluxStats {
		const fluxHistory = this.#fluxHistory;
		const filled = min(this.#fluxCursor, this.#window);
		let mean = 0;
		for (let index = 0; index < filled; index++) mean += fluxHistory[index];
		mean /= max(1, filled);
		let variance = 0;
		for (let index = 0; index < filled; index++) {
			const diff = fluxHistory[index] - mean;
			variance += diff * diff;
		}
		return new FluxStats(mean, sqrt(variance / max(1, filled)));
	}

	#detectBeat(flux: number, stats: FluxStats): boolean {
		this.#beatGap++;
		const detected = flux > stats.onsetThreshold(this.#multiplier) && this.#beatGap >= this.#minGap;
		if (detected) this.#beatGap = 0;
		return detected;
	}

	/** Analyses one frame into `output`; returns false when the frame was already processed. */
	process(frame: number, length: number, metadata: Float32Array, frequency: Float32Array, temporal: Float32Array, output: Float32Array): boolean {
		if (frame === this.#lastFrame) return false;
		this.#lastFrame = frame;

		const sampleRate = metadata[0] || 44100;

		if (this.#bins === null || length !== this.#cachedLength || sampleRate !== this.#cachedSampleRate) {
			this.#bins = this.#computeBins(length, sampleRate);
			this.#cachedLength = length;
			this.#cachedSampleRate = sampleRate;
		}

		const sliceFrequency = frequency.subarray(0, length);
		const sliceTemporal = temporal.subarray(0, length);

		const flux = this.#computeSpectralFlux(sliceFrequency, length);
		const bandEnergies = this.#computeBandEnergies(sliceFrequency);
		const zeroCrossingRate = this.#computeZeroCrossingRate(sliceTemporal, length);
		const centroid = this.#computeSpectralCentroid(sliceFrequency, length);

		const fluxStats = this.#computeFluxStats();
		const percussiveness = min(1, flux / (fluxStats.mean + 0.001));
		const beatDetected = this.#detectBeat(flux, fluxStats);

		const dropIntensity = min(1, percussiveness * 3) * bandEnergies[0];
		const bassLevel = bandEnergies[0] * 0.4 + bandEnergies[1] * 0.6;
		const distortion = min(1, percussiveness * zeroCrossingRate * 5);

		output[1] = flux;
		for (let bandIndex = 0; bandIndex < 6; bandIndex++) output[2 + bandIndex] = bandEnergies[bandIndex];
		output[8] = zeroCrossingRate;
		output[9] = centroid;
		output[10] = percussiveness;
		output[11] = Number(beatDetected);
		output[12] = dropIntensity;
		output[13] = bassLevel;
		output[14] = distortion;
		output[0] = frame;
		return true;
	}
}
//#endregion
