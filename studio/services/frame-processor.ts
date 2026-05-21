"use strict";

import "adaptive-extender/worker";
import { SceneDefinition, SabLayout } from "../models/audio-features.js";
import { NNAgent } from "../models/nn-agent.js";
import { type AutoTeacher } from "./auto-teacher.js";

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

	onsetThreshold(): number {
		return this.#mean + 1.5 * this.#standardDeviation;
	}
}
//#endregion
//#region Frame processor
export class FrameProcessor {
	static #fluxWindow: number = 43;
	static #rmsWindow: number = 8;
	static #minBeatGap: number = 8;

	#prevFrequency: Float32Array = new Float32Array(SabLayout.inputMaxLength);
	#fluxHistory: Float32Array = new Float32Array(FrameProcessor.#fluxWindow);
	#fluxCursor: number = 0;
	#rmsHistory: Float32Array = new Float32Array(FrameProcessor.#rmsWindow);
	#rmsCursor: number = 0;
	#lastFrame: number = -1;
	#frameCount: number = 0;
	#beatGap: number = FrameProcessor.#minBeatGap;

	#bins: [number, number][] | null = null;
	#cachedLength: number = 0;
	#cachedSampleRate: number = 0;

	#inputFeatures: Float32Array = new Float32Array(NNAgent.sizeInput);
	#lastInputFeatures: Float32Array = new Float32Array(NNAgent.sizeInput);

	get frameCount(): number { return this.#frameCount; }
	get lastInputFeatures(): Float32Array { return this.#lastInputFeatures; }

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
		let flux = 0;
		for (let binIndex = 0; binIndex < length; binIndex++) {
			const diff = frequency[binIndex] - this.#prevFrequency[binIndex];
			if (diff > 0) flux += diff;
		}
		flux /= length;
		this.#prevFrequency.set(frequency);
		this.#fluxHistory[this.#fluxCursor % FrameProcessor.#fluxWindow] = flux;
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
		let weightedSum = 0, energySum = 0;
		for (let binIndex = 0; binIndex < length; binIndex++) {
			weightedSum += frequency[binIndex] * binIndex;
			energySum += frequency[binIndex];
		}
		return energySum > 0.001 ? weightedSum / (energySum * length) : 0;
	}

	#computeRms(temporal: Float32Array, length: number): number {
		let sum = 0;
		for (let sampleIndex = 0; sampleIndex < length; sampleIndex++) {
			const sample = temporal[sampleIndex] * 2 - 1;
			sum += sample * sample;
		}
		const rms = sqrt(sum / length);
		this.#rmsHistory[this.#rmsCursor % FrameProcessor.#rmsWindow] = rms;
		this.#rmsCursor++;
		return rms;
	}

	#computeFluxStats(): FluxStats {
		const filled = min(this.#fluxCursor, FrameProcessor.#fluxWindow);
		let mean = 0;
		for (let index = 0; index < filled; index++) mean += this.#fluxHistory[index];
		mean /= max(1, filled);
		let variance = 0;
		for (let index = 0; index < filled; index++) {
			const diff = this.#fluxHistory[index] - mean;
			variance += diff * diff;
		}
		return new FluxStats(mean, sqrt(variance / max(1, filled)));
	}

	#detectBeat(flux: number, stats: FluxStats): boolean {
		this.#beatGap++;
		const detected = flux > stats.onsetThreshold() && this.#beatGap >= FrameProcessor.#minBeatGap;
		if (detected) this.#beatGap = 0;
		return detected;
	}

	#buildInputFeatures(flux: number, bandEnergies: Float32Array, zeroCrossingRate: number, centroid: number, percussiveness: number): void {
		this.#inputFeatures[0] = flux;
		for (let bandIndex = 0; bandIndex < 6; bandIndex++) this.#inputFeatures[1 + bandIndex] = bandEnergies[bandIndex];
		this.#inputFeatures[7] = zeroCrossingRate;
		this.#inputFeatures[8] = centroid;
		this.#inputFeatures[9] = percussiveness;
		const rmsWindow = FrameProcessor.#rmsWindow;
		for (let index = 0; index < rmsWindow; index++) {
			this.#inputFeatures[10 + index] = this.#rmsHistory[(this.#rmsCursor - 1 - index + rmsWindow) % rmsWindow];
		}
		this.#lastInputFeatures.set(this.#inputFeatures);
	}

	process(frame: number, length: number, metadata: Float32Array, frequency: Float32Array, temporal: Float32Array, output: Float32Array, model: NNAgent, teacher: AutoTeacher): void {
		if (frame === this.#lastFrame) return;
		this.#lastFrame = frame;
		this.#frameCount++;

		const sampleRate = metadata[0] || 44100;

		if (this.#bins === null || length !== this.#cachedLength || sampleRate !== this.#cachedSampleRate) {
			this.#bins = this.#computeBins(length, sampleRate);
			this.#cachedLength = length;
			this.#cachedSampleRate = sampleRate;
		}

		const frequencySlice = frequency.subarray(0, length);
		const temporalSlice = temporal.subarray(0, length);

		const flux = this.#computeSpectralFlux(frequencySlice, length);
		const bandEnergies = this.#computeBandEnergies(frequencySlice);
		const zeroCrossingRate = this.#computeZeroCrossingRate(temporalSlice, length);
		const centroid = this.#computeSpectralCentroid(frequencySlice, length);
		const currentRms = this.#computeRms(temporalSlice, length);

		const fluxStats = this.#computeFluxStats();
		const percussiveness = min(1, flux / (fluxStats.mean + 0.001));
		const beatDetected = this.#detectBeat(flux, fluxStats);

		this.#buildInputFeatures(flux, bandEnergies, zeroCrossingRate, centroid, percussiveness);

		const sceneProbs = new Float32Array(SceneDefinition.count);
		model.forward(this.#inputFeatures, sceneProbs);
		let bestScene = 0;
		for (let scene = 1; scene < SceneDefinition.count; scene++) {
			if (sceneProbs[scene] > sceneProbs[bestScene]) bestScene = scene;
		}

		const dropIntensity = min(1, percussiveness * 3) * bandEnergies[0];
		const bassLevel = bandEnergies[0] * 0.4 + bandEnergies[1] * 0.6;
		const distortionLevel = min(1, percussiveness * zeroCrossingRate * 5);

		const rmsWindow = FrameProcessor.#rmsWindow;
		const rmsOld = (this.#rmsHistory[(this.#rmsCursor - 5 + rmsWindow) % rmsWindow] + this.#rmsHistory[(this.#rmsCursor - 6 + rmsWindow) % rmsWindow]) * 0.5;
		const rmsNew = (this.#rmsHistory[(this.#rmsCursor - 1 + rmsWindow) % rmsWindow] + this.#rmsHistory[(this.#rmsCursor - 2 + rmsWindow) % rmsWindow]) * 0.5;
		const rmsSlope = rmsNew - rmsOld;

		const autoLabel = this.#classifyAutoLabel(currentRms, zeroCrossingRate, bandEnergies, percussiveness, beatDetected, rmsSlope);
		teacher.consider(autoLabel, this.#lastInputFeatures, model, this.#frameCount);

		output[1] = flux;
		for (let bandIndex = 0; bandIndex < 6; bandIndex++) output[2 + bandIndex] = bandEnergies[bandIndex];
		output[8] = zeroCrossingRate;
		output[9] = centroid;
		output[10] = percussiveness;
		output[11] = beatDetected ? 1 : 0;
		output[12] = bestScene;
		for (let scene = 0; scene < SceneDefinition.count; scene++) output[13 + scene] = sceneProbs[scene];
		output[19] = dropIntensity;
		output[20] = bassLevel;
		output[21] = distortionLevel;
		output[22] = autoLabel ?? -1;
		output[0] = frame;
	}

	#classifyAutoLabel(currentRms: number, zeroCrossingRate: number, bandEnergies: Float32Array, percussiveness: number, beatDetected: boolean, rmsSlope: number): number | null {
		if (currentRms < 0.015) return 0;
		if (zeroCrossingRate > 0.22 && bandEnergies[0] < 0.08 && bandEnergies[1] < 0.12 && bandEnergies[3] > 0.04) return 1;
		if (beatDetected && percussiveness > 0.45) return 4;
		if (percussiveness > 0.55 && bandEnergies[0] > 0.18 && currentRms > 0.12) return 5;
		if (rmsSlope > 0.012 && currentRms > 0.04 && !beatDetected) return 3;
		if (currentRms > 0.025) return 2;
		return null;
	}
}
//#endregion
