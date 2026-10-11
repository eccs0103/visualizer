"use strict";

import "adaptive-extender/web";
import { Signal } from "../models/audio-features.js";
import { type VisualizationSettings } from "../models/settings.js";
import { ModelTap } from "./model-tap.js";

const { trunc, sqrt, sqpw, log2, round } = Math;

//#region Audioset manager
export class AudiosetManager {
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
	#tap: ModelTap;
	#gain: GainNode;
	#lowShelf: BiquadFilterNode;
	#highShelf: BiquadFilterNode;
	#compressor: DynamicsCompressorNode;
	#signal: Signal = Signal.create();
	#bytes: Uint8Array<ArrayBuffer>;

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

		this.#tap = new ModelTap(context, source);

		this.#bytes = new Uint8Array(analyser.frequencyBinCount);
	}

	static get minQuality(): number { return AudiosetManager.#minQuality; }
	static get maxQuality(): number { return AudiosetManager.#maxQuality; }
	static get minSmoothing(): number { return AudiosetManager.#minSmoothing; }
	static get maxSmoothing(): number { return AudiosetManager.#maxSmoothing; }
	static get minFocus(): number { return AudiosetManager.#minFocus; }
	static get maxFocus(): number { return AudiosetManager.#maxFocus; }
	static get minSpread(): number { return AudiosetManager.#minSpread; }
	static get maxSpread(): number { return AudiosetManager.#maxSpread; }
	static get minBoost(): number { return AudiosetManager.#minBoost; }
	static get maxBoost(): number { return AudiosetManager.#maxBoost; }
	static get minTilt(): number { return AudiosetManager.#minTilt; }
	static get maxTilt(): number { return AudiosetManager.#maxTilt; }
	static get minPunch(): number { return AudiosetManager.#minPunch; }
	static get maxPunch(): number { return AudiosetManager.#maxPunch; }

	get sampleRate(): number { return this.#context.sampleRate; }
	get signal(): Signal { return this.#signal; }

	get quality(): number {
		return log2(this.#analyser.fftSize);
	}

	set quality(value: number) {
		if (!Number.isFinite(value)) throw new TypeError(`The quality ${value} must be a finite number`);
		value = trunc(value).clamp(AudiosetManager.#minQuality, AudiosetManager.#maxQuality);
		const analyser = this.#analyser;
		analyser.fftSize = (1 << value);
		this.#bytes = new Uint8Array(analyser.frequencyBinCount);
	}

	get smoothing(): number {
		return this.#analyser.smoothingTimeConstant;
	}

	set smoothing(value: number) {
		if (!Number.isFinite(value)) throw new TypeError(`The smoothing ${value} must be a finite number`);
		this.#analyser.smoothingTimeConstant = value.clamp(AudiosetManager.#minSmoothing, AudiosetManager.#maxSmoothing);
	}

	get focus(): number {
		const { maxDecibels, minDecibels } = this.#analyser;
		return (maxDecibels + minDecibels) / 2;
	}

	set focus(value: number) {
		if (!Number.isFinite(value)) throw new TypeError(`The focus ${value} must be a finite number`);
		value = value.clamp(AudiosetManager.#minFocus, AudiosetManager.#maxFocus);
		const { spread } = this;
		this.#applyDecibels(round(value - spread), round(value + spread));
	}

	get spread(): number {
		const { maxDecibels, minDecibels } = this.#analyser;
		return (maxDecibels - minDecibels) / 2;
	}

	set spread(value: number) {
		if (!Number.isFinite(value)) throw new TypeError(`The spread ${value} must be a finite number`);
		value = value.clamp(AudiosetManager.#minSpread, AudiosetManager.#maxSpread);
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
		if (!Number.isFinite(value)) throw new TypeError(`The boost ${value} must be a finite number`);
		this.#gain.gain.value = value.clamp(AudiosetManager.#minBoost, AudiosetManager.#maxBoost);
	}

	get tilt(): number {
		return this.#highShelf.gain.value;
	}

	set tilt(value: number) {
		if (!Number.isFinite(value)) throw new TypeError(`The tilt ${value} must be a finite number`);
		value = value.clamp(AudiosetManager.#minTilt, AudiosetManager.#maxTilt);
		this.#lowShelf.gain.value = -value;
		this.#highShelf.gain.value = value;
	}

	get punch(): number {
		return this.#compressor.ratio.value.lerp(1, 12, 0, 1);
	}

	set punch(value: number) {
		if (!Number.isFinite(value)) throw new TypeError(`The punch ${value} must be a finite number`);
		value = value.clamp(AudiosetManager.#minPunch, AudiosetManager.#maxPunch);
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

		this.#tap.capture(model);

		signal.publish(length, sqrt(summary / length), performance.timeOrigin + performance.now());
	}
}
//#endregion
