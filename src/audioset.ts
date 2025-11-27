"use strict";

import "adaptive-extender/web";

const { sqrt, sqpw, abs, log2 } = Math;

//#region Audioset
interface AudiosetManager {
	get quality(): number;
	set quality(value: number);
	get smoothing(): number;
	set smoothing(value: number);
	get focus(): number;
	set focus(value: number);
	get spread(): number;
	set spread(value: number);
	get autocorrect(): boolean;
	set autocorrect(value: boolean);
	get audioset(): Audioset;
	refresh(): void;
}

interface AudiosetManagerConstructor {
	new(media: HTMLMediaElement): AudiosetManager;
	checkQuality(value: number): boolean;
	checkSmoothing(value: number): boolean;
	checkFocus(value: number): boolean;
	checkSpread(value: number): boolean;
}

class Audioset {
	//#region Manager
	static #Manager: AudiosetManagerConstructor = class Manager implements AudiosetManager {
		#context: AudioContext;
		#analyser: AnalyserNode;
		#autocorrect: boolean = false;
		#audioset: Audioset;
		#dataTemporary: Uint8Array<ArrayBuffer>;

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
			audioset.#normsDataFrequency = new Float32Array(length);
			audioset.#normsDataTemporal = new Float32Array(length);
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

		get autocorrect(): boolean {
			return this.#autocorrect;
		}

		set autocorrect(value: boolean) {
			this.#autocorrect = value;
		}

		get audioset(): Audioset {
			return this.#audioset;
		}

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
			const normsDataFrequency = audioset.#normsDataFrequency;
			const normsDataTemporal = audioset.#normsDataTemporal;

			let summaryVolume = 0, summaryAmplitude = 0;
			let minDecibel = Infinity, maxDecibel = -Infinity;

			analyser.getByteFrequencyData(dataTemporary);
			for (let index = 0; index < length; index++) {
				const normDatumFrequency = dataTemporary[index] / 255;
				normsDataFrequency[index] = normDatumFrequency;
				const decibel = minDecibels + normDatumFrequency * range;
				if (decibel < minDecibel) minDecibel = decibel;
				if (decibel > maxDecibel) maxDecibel = decibel;
			}

			analyser.getByteTimeDomainData(dataTemporary);
			for (let index = 0; index < length; index++) {
				const normDatumTemporal = dataTemporary[index] / 255;
				normsDataTemporal[index] = normDatumTemporal;
				const bipolarDatumTemporal = normDatumTemporal * 2 - 1;
				const normAmplitude = abs(bipolarDatumTemporal);
				summaryVolume += sqpw(bipolarDatumTemporal);
				summaryAmplitude += sqpw(normAmplitude);
			}

			audioset.#normVolume = sqrt(summaryVolume / length);
			audioset.#normAmplitude = sqrt(summaryAmplitude / length);

			if (!this.#autocorrect) return;

			analyser.minDecibels = minDecibel;
			analyser.maxDecibels = maxDecibel + 5;
		}
	};
	static get Manager(): AudiosetManagerConstructor {
		return this.#Manager;
	}
	//#endregion

	static #lock: boolean = true;
	#length: number;
	#normsDataFrequency: Float32Array;
	#normsDataTemporal: Float32Array;
	#normVolume: number;
	#normAmplitude: number;
	get length(): number {
		return this.#length;
	}

	get normsDataFrequency(): Float32Array {
		return this.#normsDataFrequency;
	}

	get normsDataTemporal(): Float32Array {
		return this.#normsDataTemporal;
	}

	get normVolume(): number {
		return this.#normVolume;
	}

	get normAmplitude(): number {
		return this.#normAmplitude;
	}

	constructor(length: number) {
		if (Audioset.#lock) throw new TypeError("Illegal constructor");
		this.#length = length;
		this.#normsDataFrequency = new Float32Array(length);
		this.#normsDataTemporal = new Float32Array(length);
		this.#normVolume = 0;
		this.#normAmplitude = 0;
	}

	static #construct(length: number): Audioset {
		Audioset.#lock = false;
		const self = new Audioset(length);
		Audioset.#lock = true;
		return self;
	}
}
//#endregion

export { type AudiosetManager, type AudiosetManagerConstructor };
export { Audioset };
