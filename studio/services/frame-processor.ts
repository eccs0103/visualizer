"use strict";

import "adaptive-extender/worker";
import { SabLayout } from "../models/audio-features.js";
import { NNAgent } from "../models/nn-agent.js";
import { type PolicyUpdater } from "./policy-updater.js";

const { abs, max, round, min, sqrt, trunc } = Math;

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
	static #minBeatGap: number = 8;
	static #featCount: number = 10;
	static #histSize: number = 32;
	static #emaAlpha: number = 0.9995;
	static #emaWarmup: number = 200;
	static #epsNorm: number = 1e-6;
	static #holdStep: number = 64;
	static #maxGain: number = 15;
	static #scaleHeuristic: number = 0.2;

	#prevFrequency: Float32Array = new Float32Array(SabLayout.inputMaxLength);
	#fluxHistory: Float32Array = new Float32Array(FrameProcessor.#fluxWindow);
	#fluxCursor: number = 0;
	#lastFrame: number = -1;
	#frameCount: number = 0;
	#beatGap: number = FrameProcessor.#minBeatGap;

	#bins: [number, number][] | null = null;
	#cachedLength: number = 0;
	#cachedSampleRate: number = 0;

	#emaMean: Float32Array = new Float32Array(FrameProcessor.#featCount);
	#emaVar: Float32Array = new Float32Array(FrameProcessor.#featCount);
	#rawFeats: Float32Array = new Float32Array(FrameProcessor.#featCount);
	#normBuf: Float32Array = new Float32Array(FrameProcessor.#featCount);
	#featHistory: Float32Array = new Float32Array(FrameProcessor.#histSize * FrameProcessor.#featCount);
	#lastControlOutput: Float32Array = new Float32Array(NNAgent.sizeControl);
	#lastValueOutput: Float32Array = new Float32Array(1);
	#sign: number = 0;
	#hold: number = 0;
	#engaged: boolean = false;
	#active: boolean = true;

	constructor() {
		this.#emaVar.fill(1);
	}

	set active(value: boolean) { this.#active = value; }

	injectFeedback(sign: number): void {
		if (sign !== this.#sign) {
			this.#sign = sign;
			this.#hold = 0;
		}
		if (sign !== 0) this.#engaged = true;
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
		const filled = min(this.#fluxCursor, FrameProcessor.#fluxWindow);
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
		const detected = flux > stats.onsetThreshold() && this.#beatGap >= FrameProcessor.#minBeatGap;
		if (detected) this.#beatGap = 0;
		return detected;
	}

	#fillInput(flux: number, bandEnergies: Float32Array, zeroCrossingRate: number, centroid: number, percussiveness: number): void {
		const raw = this.#rawFeats;
		raw[0] = flux;
		for (let bandIndex = 0; bandIndex < 6; bandIndex++) raw[1 + bandIndex] = bandEnergies[bandIndex];
		raw[7] = zeroCrossingRate;
		raw[8] = centroid;
		raw[9] = percussiveness;

		const mean = this.#emaMean, variance = this.#emaVar;
		const alpha = FrameProcessor.#emaAlpha, epsilon = FrameProcessor.#epsNorm;
		const norm = this.#normBuf;
		const doNorm = this.#frameCount >= FrameProcessor.#emaWarmup;
		for (let index = 0; index < FrameProcessor.#featCount; index++) {
			const rawValue = raw[index];
			mean[index] = alpha * mean[index] + (1 - alpha) * rawValue;
			const diff = rawValue - mean[index];
			variance[index] = alpha * variance[index] + (1 - alpha) * diff * diff;
			norm[index] = rawValue;
			if (doNorm) norm[index] = (rawValue - mean[index]) / sqrt(variance[index] + epsilon);
		}
	}

	#pushHistory(): void {
		const hist = this.#featHistory, count = FrameProcessor.#featCount;
		hist.copyWithin(0, count);
		hist.set(this.#normBuf, (FrameProcessor.#histSize - 1) * count);
	}

	#computeFeedbackGain(sign: number): number {
		if (sign === 0) return 0;
		const hold = this.#hold;
		this.#hold = hold + 1;
		const step = trunc(hold / FrameProcessor.#holdStep) + 1;
		const gain = step * (step + 1) / 2;
		return gain.clamp(0, FrameProcessor.#maxGain);
	}

	#computeBeatReward(beatDetected: boolean, engagement: number): number {
		if (!beatDetected) return 0;
		if (engagement > 0.3) return 1;
		return -0.5;
	}

	#computeRlReward(sign: number, controlOutput: Float32Array, bassLevel: number, dropIntensity: number, percussiveness: number, beatDetected: boolean): number {
		// While a thumb is held, the human signal is the sole reward — fully authoritative
		if (sign !== 0) return sign.clamp(-1, 1);

		// Composite audio energy: how energetic is this frame
		const audioEnergy = min(1, bassLevel * 0.5 + dropIntensity * 0.3 + percussiveness * 0.2);

		// DJ engagement: average absolute control delta — how much is the AI doing
		let engagement = 0;
		for (let param = 0; param < NNAgent.sizeControl; param++) engagement += abs(controlOutput[param]);
		engagement /= NNAgent.sizeControl;

		// rSync: engagement should match audio energy (quiet = low engagement, loud = high)
		const rSync = 1 - 2 * abs(engagement - audioEnergy);

		// rBeat: engagement should spike on beats
		const rBeat = this.#computeBeatReward(beatDetected, engagement);

		const rBase = 0.8 * rSync + 0.2 * rBeat;

		// After the user has given feedback at least once, soften the heuristic so taught
		// behavior is not slowly overwritten when no thumb is held
		if (this.#engaged) return rBase * FrameProcessor.#scaleHeuristic;
		return rBase;
	}

	process(frame: number, length: number, metadata: Float32Array, frequency: Float32Array, temporal: Float32Array, output: Float32Array, model: NNAgent, policy: PolicyUpdater): void {
		if (frame === this.#lastFrame) return;
		this.#lastFrame = frame;
		this.#frameCount++;

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

		this.#fillInput(flux, bandEnergies, zeroCrossingRate, centroid, percussiveness);
		this.#pushHistory();

		const active = this.#active;
		const featHistory = this.#featHistory;
		const lastControlOutput = this.#lastControlOutput;
		const lastValueOutput = this.#lastValueOutput;
		if (active) model.forwardControl(featHistory, lastControlOutput, lastValueOutput);
		else {
			lastControlOutput.fill(0);
			lastValueOutput.fill(0);
		}

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
		for (let param = 0; param < NNAgent.sizeControl; param++) output[15 + param] = lastControlOutput[param];
		output[0] = frame;

		if (!active) {
			output[20] = 0;
			return;
		}

		const sign = this.#sign;
		const gain = this.#computeFeedbackGain(sign);

		const reward = this.#computeRlReward(sign, lastControlOutput, bassLevel, dropIntensity, percussiveness, beatDetected);
		output[20] = reward;

		policy.consider(featHistory, lastControlOutput, lastValueOutput[0], reward, model, this.#frameCount, sign, gain);
	}
}
//#endregion
