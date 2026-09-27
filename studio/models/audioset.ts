"use strict";

import "adaptive-extender/web";
import { Signal } from "./audio-features.js";
import { type VisualizationSettings } from "./settings.js";

const { trunc, sqrt, sqpw, log2, round } = Math;

//#region Audioset
export class Audioset {
	static #minQuality: number = 5;
	static #maxQuality: number = 15;
	static #minSmoothing: number = 0;
	static #maxSmoothing: number = 1;
	static #minFocus: number = -100;
	static #maxFocus: number = -20;
	static #minSpread: number = 1;
	static #maxSpread: number = 59;
	static #minBoost: number = 0.25;
	static #maxBoost: number = 4;
	static #minTilt: number = -12;
	static #maxTilt: number = 12;
	static #minPunch: number = 0;
	static #maxPunch: number = 1;

	#context: AudioContext;
	#analyser: AnalyserNode;
	#analyserModel: AnalyserNode;
	#gain: GainNode;
	#lowShelf: BiquadFilterNode;
	#highShelf: BiquadFilterNode;
	#compressor: DynamicsCompressorNode;
	#signal: Signal = Signal.create();
	#bytes: Uint8Array<ArrayBuffer>;
	#bytesModel: Uint8Array<ArrayBuffer>;

	constructor(media: HTMLMediaElement) {
		const context = this.#context = new AudioContext();
		media.addEventListener("play", async event => await context.resume());

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
		compressor.threshold.value = 0;
		compressor.ratio.value = 1;
		compressor.knee.value = 30;

		const analyser = this.#analyser = context.createAnalyser();
		source.connect(gain);
		gain.connect(lowShelf);
		lowShelf.connect(highShelf);
		highShelf.connect(compressor);
		compressor.connect(analyser);

		const analyserModel = this.#analyserModel = context.createAnalyser();
		analyserModel.fftSize = 1024;
		analyserModel.smoothingTimeConstant = 0.6;
		analyserModel.minDecibels = -90;
		analyserModel.maxDecibels = -30;
		source.connect(analyserModel);

		this.#bytes = new Uint8Array(analyser.frequencyBinCount);
		this.#bytesModel = new Uint8Array(analyserModel.frequencyBinCount);
	}

	static get minQuality(): number { return Audioset.#minQuality; }
	static get maxQuality(): number { return Audioset.#maxQuality; }
	static get minSmoothing(): number { return Audioset.#minSmoothing; }
	static get maxSmoothing(): number { return Audioset.#maxSmoothing; }
	static get minFocus(): number { return Audioset.#minFocus; }
	static get maxFocus(): number { return Audioset.#maxFocus; }
	static get minSpread(): number { return Audioset.#minSpread; }
	static get maxSpread(): number { return Audioset.#maxSpread; }
	static get minBoost(): number { return Audioset.#minBoost; }
	static get maxBoost(): number { return Audioset.#maxBoost; }
	static get minTilt(): number { return Audioset.#minTilt; }
	static get maxTilt(): number { return Audioset.#maxTilt; }
	static get minPunch(): number { return Audioset.#minPunch; }
	static get maxPunch(): number { return Audioset.#maxPunch; }

	get sampleRate(): number { return this.#context.sampleRate; }
	get signal(): Signal { return this.#signal; }

	get quality(): number {
		return log2(this.#analyser.fftSize);
	}

	set quality(value: number) {
		if (!Number.isFinite(value)) throw new Error(`The quality ${value} must be a finite number`);
		value = trunc(value).clamp(Audioset.#minQuality, Audioset.#maxQuality);
		const analyser = this.#analyser;
		analyser.fftSize = (1 << value);
		this.#bytes = new Uint8Array(analyser.frequencyBinCount);
	}

	get smoothing(): number {
		return this.#analyser.smoothingTimeConstant;
	}

	set smoothing(value: number) {
		if (!Number.isFinite(value)) throw new Error(`The smoothing ${value} must be a finite number`);
		this.#analyser.smoothingTimeConstant = value.clamp(Audioset.#minSmoothing, Audioset.#maxSmoothing);
	}

	get focus(): number {
		const { maxDecibels, minDecibels } = this.#analyser;
		return (maxDecibels + minDecibels) / 2;
	}

	set focus(value: number) {
		if (!Number.isFinite(value)) throw new Error(`The focus ${value} must be a finite number`);
		value = value.clamp(Audioset.#minFocus, Audioset.#maxFocus);
		const { spread } = this;
		this.#applyDecibels(round(value - spread), round(value + spread));
	}

	get spread(): number {
		const { maxDecibels, minDecibels } = this.#analyser;
		return (maxDecibels - minDecibels) / 2;
	}

	set spread(value: number) {
		if (!Number.isFinite(value)) throw new Error(`The spread ${value} must be a finite number`);
		value = value.clamp(Audioset.#minSpread, Audioset.#maxSpread);
		const { focus } = this;
		this.#applyDecibels(round(focus - value), round(focus + value));
	}

	#applyDecibels(minDecibels: number, maxDecibels: number): void {
		const analyser = this.#analyser;
		if (minDecibels >= analyser.maxDecibels) {
			analyser.maxDecibels = maxDecibels;
			analyser.minDecibels = minDecibels;
			return;
		}
		analyser.minDecibels = minDecibels;
		analyser.maxDecibels = maxDecibels;
	}

	get boost(): number {
		return this.#gain.gain.value;
	}

	set boost(value: number) {
		if (!Number.isFinite(value)) throw new Error(`The boost ${value} must be a finite number`);
		this.#gain.gain.value = value.clamp(Audioset.#minBoost, Audioset.#maxBoost);
	}

	get tilt(): number {
		return this.#highShelf.gain.value;
	}

	set tilt(value: number) {
		if (!Number.isFinite(value)) throw new Error(`The tilt ${value} must be a finite number`);
		value = value.clamp(Audioset.#minTilt, Audioset.#maxTilt);
		this.#lowShelf.gain.value = -value;
		this.#highShelf.gain.value = value;
	}

	get punch(): number {
		return this.#compressor.ratio.value.lerp(1, 12, 0, 1);
	}

	set punch(value: number) {
		if (!Number.isFinite(value)) throw new Error(`The punch ${value} must be a finite number`);
		value = value.clamp(Audioset.#minPunch, Audioset.#maxPunch);
		const compressor = this.#compressor;
		compressor.threshold.value = value.lerp(0, 1, 0, -24);
		compressor.ratio.value = value.lerp(0, 1, 1, 12);
		compressor.knee.value = value.lerp(0, 1, 30, 0);
	}

	apply(configuration: VisualizationSettings): void {
		this.quality = configuration.quality;
		this.smoothing = configuration.smoothing;
		this.focus = configuration.focus;
		this.spread = configuration.spread;
		this.boost = configuration.boost;
		this.tilt = configuration.tilt;
		this.punch = configuration.punch;
	}

	capture(): void {
		const signal = this.#signal;
		const bytes = this.#bytes;
		const bytesModel = this.#bytesModel;
		const { frequency, temporal, model } = signal;
		const analyser = this.#analyser;
		const { length } = bytes;

		analyser.getByteFrequencyData(bytes);
		for (let index = 0; index < length; index++) frequency[index] = bytes[index] / 255;

		let summary = 0;
		analyser.getByteTimeDomainData(bytes);
		for (let index = 0; index < length; index++) {
			const datum = bytes[index] / 255;
			temporal[index] = datum;
			summary += sqpw(datum * 2 - 1);
		}

		this.#analyserModel.getByteFrequencyData(bytesModel);
		for (let index = 0; index < bytesModel.length; index++) model[index] = bytesModel[index] / 255;

		signal.publish(length, sqrt(summary / length), performance.timeOrigin + performance.now());
	}
}
//#endregion
