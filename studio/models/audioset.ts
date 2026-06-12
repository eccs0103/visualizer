"use strict";

import "adaptive-extender/web";
import { type Scene, AudioFeatures } from "./audio-features.js";
import { type AudiosetView } from "./visualization.js";

const { sqrt, sqpw, abs, log2 } = Math;

//#region Audioset
export interface AudiosetManager {
	get quality(): number;
	set quality(value: number);
	get smoothing(): number;
	set smoothing(value: number);
	get focus(): number;
	set focus(value: number);
	get spread(): number;
	set spread(value: number);
	get autoCorrect(): boolean;
	set autoCorrect(value: boolean);
	get rate(): number;
	get audioset(): Audioset;
	refresh(): void;
	readFeatures(out: Float32Array): void;
}

export interface AudiosetManagerConstructor {
	new(media: HTMLMediaElement): AudiosetManager;
	checkQuality(value: number): boolean;
	checkSmoothing(value: number): boolean;
	checkFocus(value: number): boolean;
	checkSpread(value: number): boolean;
}

export class Audioset implements AudiosetView {
	//#region Manager
	static #Manager: AudiosetManagerConstructor = class Manager implements AudiosetManager {
		#context: AudioContext;
		#analyser: AnalyserNode;
		#autoCorrect: boolean = false;
		#audioset: Audioset;
		#dataTemporary: Uint8Array<ArrayBuffer>;

		constructor(media: HTMLMediaElement) {
			const context = this.#context = new AudioContext();
			media.addEventListener("play", async event => await context.resume());
			const source = context.createMediaElementSource(media);
			const analyser = this.#analyser = context.createAnalyser();

			source.connect(analyser);
			analyser.connect(context.destination);

			const length = analyser.frequencyBinCount;
			this.#audioset = Audioset.#construct(length);
			this.#dataTemporary = new Uint8Array(length);
		}

		get quality(): number {
			return log2(this.#analyser.fftSize);
		}

		set quality(value: number) {
			if (!Manager.checkQuality(value)) return;
			const analyser = this.#analyser;
			const audioset = this.#audioset;
			analyser.fftSize = (1 << value);
			const length = analyser.frequencyBinCount;
			audioset.#length = length;
			audioset.#dataFrequency = new Float32Array(length);
			audioset.#dataTemporal = new Float32Array(length);
			this.#dataTemporary = new Uint8Array(length);
		}

		get smoothing(): number {
			return this.#analyser.smoothingTimeConstant;
		}

		set smoothing(value: number) {
			if (!Manager.checkSmoothing(value)) return;
			this.#analyser.smoothingTimeConstant = value;
		}

		get focus(): number {
			const { minDecibels, maxDecibels } = this.#analyser;
			return (minDecibels + maxDecibels) / 2;
		}

		set focus(value: number) {
			if (!Manager.checkFocus(value)) return;
			const { spread } = this;
			const analyser = this.#analyser;
			analyser.minDecibels = value - spread;
			analyser.maxDecibels = value + spread;
		}

		get spread(): number {
			const { minDecibels, maxDecibels } = this.#analyser;
			return (maxDecibels - minDecibels) / 2;
		}

		set spread(value: number) {
			if (!Manager.checkSpread(value)) return;
			const analyser = this.#analyser, { focus } = this;
			analyser.minDecibels = focus - value;
			analyser.maxDecibels = focus + value;
		}

		get autoCorrect(): boolean { return this.#autoCorrect; }
		set autoCorrect(value: boolean) { this.#autoCorrect = value; }
		get rate(): number { return this.#context.sampleRate; }
		get audioset(): Audioset { return this.#audioset; }

		readFeatures(out: Float32Array): void {
			this.#audioset.#features.readFrom(out);
		}

		static checkQuality(value: number): boolean {
			if (!Number.isInteger(value)) return false;
			if (5 > value || value > 15) return false;
			return true;
		}

		static checkSmoothing(value: number): boolean {
			if (!Number.isFinite(value)) return false;
			if (0 > value || value > 1) return false;
			return true;
		}

		static checkFocus(value: number): boolean {
			if (!Number.isFinite(value)) return false;
			return true;
		}

		static checkSpread(value: number): boolean {
			if (!Number.isFinite(value)) return false;
			if (0 >= value) return false;
			return true;
		}

		refresh(): void {
			const analyser = this.#analyser;
			const { minDecibels } = analyser;
			const range = analyser.maxDecibels - minDecibels;
			const audioset = this.#audioset;
			const { length } = audioset;
			const dataTemporary = this.#dataTemporary;
			const dataFrequency = audioset.#dataFrequency;
			const dataTemporal = audioset.#dataTemporal;

			let summaryVolume = 0, summaryAmplitude = 0;
			let minDecibel = Infinity, maxDecibel = -Infinity;

			analyser.getByteFrequencyData(dataTemporary);
			for (let index = 0; index < length; index++) {
				const normDatumFrequency = dataTemporary[index] / 255;
				dataFrequency[index] = normDatumFrequency;
				const decibel = minDecibels + normDatumFrequency * range;
				if (decibel < minDecibel) minDecibel = decibel;
				if (decibel > maxDecibel) maxDecibel = decibel;
			}

			analyser.getByteTimeDomainData(dataTemporary);
			for (let index = 0; index < length; index++) {
				const normDatumTemporal = dataTemporary[index] / 255;
				dataTemporal[index] = normDatumTemporal;
				const bipolarDatumTemporal = normDatumTemporal * 2 - 1;
				const amplitude = abs(bipolarDatumTemporal);
				summaryVolume += sqpw(bipolarDatumTemporal);
				summaryAmplitude += sqpw(amplitude);
			}

			audioset.#volume = sqrt(summaryVolume / length);
			audioset.#amplitude = sqrt(summaryAmplitude / length);
		}
	};

	static get Manager(): AudiosetManagerConstructor { return this.#Manager; }
	//#endregion

	static #lock: boolean = true;
	#length: number;
	#dataFrequency: Float32Array;
	#dataTemporal: Float32Array;
	#volume: number;
	#amplitude: number;
	#features: AudioFeatures = new AudioFeatures();

	constructor(length: number) {
		if (Audioset.#lock) throw new TypeError("Illegal constructor");
		this.#length = length;
		this.#dataFrequency = new Float32Array(length);
		this.#dataTemporal = new Float32Array(length);
		this.#volume = 0;
		this.#amplitude = 0;
	}

	static #construct(length: number): Audioset {
		Audioset.#lock = false;
		const self = new Audioset(length);
		Audioset.#lock = true;
		return self;
	}

	get length(): number { return this.#length; }
	get dataFrequency(): Float32Array { return this.#dataFrequency; }
	get dataTemporal(): Float32Array { return this.#dataTemporal; }
	get volume(): number { return this.#volume; }
	get amplitude(): number { return this.#amplitude; }
	get spectralFlux(): number { return this.#features.spectralFlux; }
	get subBass(): number { return this.#features.bandEnergy.subBass; }
	get bass(): number { return this.#features.bandEnergy.bass; }
	get lowMid(): number { return this.#features.bandEnergy.lowMid; }
	get mid(): number { return this.#features.bandEnergy.mid; }
	get highMid(): number { return this.#features.bandEnergy.highMid; }
	get high(): number { return this.#features.bandEnergy.high; }
	get zeroCrossingRate(): number { return this.#features.zeroCrossingRate; }
	get spectralCentroid(): number { return this.#features.spectralCentroid; }
	get percussiveness(): number { return this.#features.percussiveness; }
	get beatDetected(): boolean { return this.#features.beatDetected; }
	get scene(): Scene { return this.#features.scene; }
	get confidence(): number { return this.#features.confidence; }
	get probabilities(): ReadonlyMap<Scene, number> { return this.#features.probabilities; }
	get dropIntensity(): number { return this.#features.dropIntensity; }
	get bassLevel(): number { return this.#features.bassLevel; }
	get distortionLevel(): number { return this.#features.distortionLevel; }
	get dspScene(): number { return this.#features.dspScene; }
	get rlFocus(): number { return this.#features.rlFocus; }
	get rlSpread(): number { return this.#features.rlSpread; }
	isActive(): boolean { return this.#features.isActive(); }
	isPercussive(): boolean { return this.#features.isPercussive(); }
}
//#endregion
