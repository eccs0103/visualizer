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
		#autocorrect: boolean = false;
		get autocorrect(): boolean {
			return this.#autocorrect;
		}
		set autocorrect(value: boolean) {
			this.#autocorrect = value;
		}
		#audioset: Audioset;
		get audioset(): Audioset {
			return this.#audioset;
		}
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

	#length: number;
	get length(): number {
		return this.#length;
	}
	#normsDataFrequency: Float32Array;
	get normsDataFrequency(): Float32Array {
		return this.#normsDataFrequency;
	}
	#normsDataTemporal: Float32Array;
	get normsDataTemporal(): Float32Array {
		return this.#normsDataTemporal;
	}
	#normVolume: number;
	get normVolume(): number {
		return this.#normVolume;
	}
	#normAmplitude: number;
	get normAmplitude(): number {
		return this.#normAmplitude;
	}
	static #lock: boolean = true;
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

export type { AudiosetManager, AudiosetManagerConstructor };
export { Audioset };
