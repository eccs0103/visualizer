"use strict";

import "adaptive-extender/web";
import { AudioFeatures } from "./audio-features.js";
import { type AudiosetView } from "./visualization.js";

const { trunc, sqrt, sqpw, abs, log2, round } = Math;

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
	get boost(): number;
	set boost(value: number);
	get tilt(): number;
	set tilt(value: number);
	get punch(): number;
	set punch(value: number);
	get autoCorrect(): boolean;
	set autoCorrect(value: boolean);
	get rate(): number;
	get audioset(): Audioset;
	refresh(): void;
	readFeatures(out: Float32Array): void;
}

export interface AudiosetManagerConstructor {
	new(media: HTMLMediaElement): AudiosetManager;
	get minQuality(): number;
	get maxQuality(): number;
	get minSmoothing(): number;
	get maxSmoothing(): number;
	get minSpread(): number;
	get minBoost(): number;
	get maxBoost(): number;
	get minTilt(): number;
	get maxTilt(): number;
	get minPunch(): number;
	get maxPunch(): number;
}

export class Audioset implements AudiosetView {
	//#region Manager
	static #Manager: AudiosetManagerConstructor = class Manager implements AudiosetManager {
		static #minQuality: number = 5;
		static #maxQuality: number = 15;
		static #minSmoothing: number = 0;
		static #maxSmoothing: number = 1;
		static #minSpread: number = Number.EPSILON;
		static #minBoost: number = 0.25;
		static #maxBoost: number = 4;
		static #minTilt: number = -12;
		static #maxTilt: number = 12;
		static #minPunch: number = 0;
		static #maxPunch: number = 1;
		#context: AudioContext;
		#analyser: AnalyserNode;
		#gain: GainNode;
		#lowShelf: BiquadFilterNode;
		#highShelf: BiquadFilterNode;
		#compressor: DynamicsCompressorNode;
		#autoCorrect: boolean = false;
		#audioset: Audioset;
		#dataTemporary: Uint8Array<ArrayBuffer>;

		constructor(media: HTMLMediaElement) {
			const context = this.#context = new AudioContext();
			media.addEventListener("play", async event => await context.resume());

			// One source, two connect paths: playback (untouched) + analysis-only branch
			const source = context.createMediaElementSource(media);
			source.connect(context.destination);

			const gain = this.#gain = context.createGain();
			gain.gain.value = 1;

			const lowShelf = this.#lowShelf = context.createBiquadFilter();
			lowShelf.type = "lowshelf";
			lowShelf.frequency.value = 250;
			lowShelf.gain.value = 0;

			const highShelf = this.#highShelf = context.createBiquadFilter();
			highShelf.type = "highshelf";
			highShelf.frequency.value = 3000;
			highShelf.gain.value = 0;

			const compressor = this.#compressor = context.createDynamicsCompressor();
			// punch = 0 → ratio 1 (transparent), threshold 0 (never triggers)
			compressor.threshold.value = 0;
			compressor.ratio.value = 1;
			compressor.knee.value = 30;

			const analyser = this.#analyser = context.createAnalyser();
			source.connect(gain);
			gain.connect(lowShelf);
			lowShelf.connect(highShelf);
			highShelf.connect(compressor);
			compressor.connect(analyser);
			// analyser NOT connected to destination — analysis tap only

			const length = analyser.frequencyBinCount;
			this.#audioset = Audioset.#construct(length);
			this.#dataTemporary = new Uint8Array(length);
		}

		static get minQuality(): number { return this.#minQuality; }
		static get maxQuality(): number { return this.#maxQuality; }
		static get minSmoothing(): number { return this.#minSmoothing; }
		static get maxSmoothing(): number { return this.#maxSmoothing; }
		static get minSpread(): number { return this.#minSpread; }
		static get minBoost(): number { return this.#minBoost; }
		static get maxBoost(): number { return this.#maxBoost; }
		static get minTilt(): number { return this.#minTilt; }
		static get maxTilt(): number { return this.#maxTilt; }
		static get minPunch(): number { return this.#minPunch; }
		static get maxPunch(): number { return this.#maxPunch; }

		get quality(): number {
			return log2(this.#analyser.fftSize);
		}

		set quality(value: number) {
			if (!Number.isFinite(value)) throw new Error(`The quality ${value} must be a finite number`);
			value = trunc(value).clamp(Manager.minQuality, Manager.#maxQuality);
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
			if (!Number.isFinite(value)) throw new Error(`The smoothing ${value} must be a finite number`);
			value = value.clamp(Manager.#minSmoothing, Manager.#maxSmoothing);
			this.#analyser.smoothingTimeConstant = value;
		}

		get focus(): number {
			const { maxDecibels, minDecibels } = this.#analyser;
			return (maxDecibels + minDecibels) / 2;
		}

		set focus(value: number) {
			if (!Number.isFinite(value)) throw new Error(`The focus ${value} must be a finite number`);
			const { spread } = this;
			const analyser = this.#analyser;
			analyser.minDecibels = round(value - spread);
			analyser.maxDecibels = round(value + spread);
		}

		get spread(): number {
			const { maxDecibels, minDecibels } = this.#analyser;
			return (maxDecibels - minDecibels) / 2;
		}

		set spread(value: number) {
			if (!Number.isFinite(value)) throw new Error(`The spread ${value} must be a finite number`);
			value = value.clamp(Manager.#minSpread, Infinity);
			const analyser = this.#analyser, { focus } = this;
			analyser.minDecibels = round(focus - value);
			analyser.maxDecibels = round(focus + value);
		}

		get boost(): number {
			return this.#gain.gain.value;
		}

		set boost(value: number) {
			if (!Number.isFinite(value)) throw new Error(`The boost ${value} must be a finite number`);
			value = value.clamp(Manager.#minBoost, Manager.#maxBoost);
			this.#gain.gain.value = value;
		}

		get tilt(): number {
			return this.#highShelf.gain.value;
		}

		set tilt(value: number) {
			if (!Number.isFinite(value)) throw new Error(`The tilt ${value} must be a finite number`);
			value = value.clamp(Manager.#minTilt, Manager.#maxTilt);
			this.#lowShelf.gain.value = -value;
			this.#highShelf.gain.value = value;
		}

		get punch(): number {
			return (this.#compressor.ratio.value - 1) / 11; /** @todo number.lerp? */
		}

		set punch(value: number) {
			if (!Number.isFinite(value)) throw new Error(`The punch ${value} must be a finite number`);
			value = value.clamp(Manager.#minPunch, Manager.#maxPunch);
			const compressor = this.#compressor;
			compressor.threshold.value = -value * 24; /** @todo number.lerp? */
			compressor.ratio.value = 1 + value * 11; /** @todo number.lerp? */
			compressor.knee.value = 30 * (1 - value); /** @todo number.lerp? */
		}

		get autoCorrect(): boolean { return this.#autoCorrect; }
		set autoCorrect(value: boolean) { this.#autoCorrect = value; }
		get rate(): number { return this.#context.sampleRate; }
		get audioset(): Audioset { return this.#audioset; }

		readFeatures(out: Float32Array): void {
			this.#audioset.#features.readFrom(out);
		}

		refresh(): void {
			const analyser = this.#analyser;
			const audioset = this.#audioset;
			const { length } = audioset;
			const dataTemporary = this.#dataTemporary;
			const dataFrequency = audioset.#dataFrequency;
			const dataTemporal = audioset.#dataTemporal;

			let summaryVolume = 0, summaryAmplitude = 0;

			analyser.getByteFrequencyData(dataTemporary);
			for (let index = 0; index < length; index++) {
				dataFrequency[index] = dataTemporary[index] / 255;
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
	get dropIntensity(): number { return this.#features.dropIntensity; }
	get bassLevel(): number { return this.#features.bassLevel; }
	get distortionLevel(): number { return this.#features.distortionLevel; }
	get djFocus(): number { return this.#features.djFocus; }
	get djSpread(): number { return this.#features.djSpread; }
	get djBoost(): number { return this.#features.djBoost; }
	get djTilt(): number { return this.#features.djTilt; }
	get djPunch(): number { return this.#features.djPunch; }
	isActive(): boolean { return this.#features.isActive(); }
	isPercussive(): boolean { return this.#features.isPercussive(); }
}
//#endregion
