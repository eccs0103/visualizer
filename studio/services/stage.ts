"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { SabLayout, Signal, StemMasks } from "../models/audio-features.js";
import { type Audioset, type Environment, type LyricsWindow } from "../models/visualization.js";
import { SpectrumAnalysis } from "./visualization-tools.js";

//#region Stage
export class Stage implements Audioset, Environment {
	#signal: Signal;
	#masks: StemMasks;
	#sampleRate: number;
	#analysis: SpectrumAnalysis = new SpectrumAnalysis();
	#frame: number | null = null;
	#length: number = 0;
	#time: number = NaN;
	#frequency: Float32Array;
	#temporal: Float32Array;
	#waveform: Float32Array = new Float32Array(0);
	#levelWaveform: number | null = null;
	#frameWaveform: number | null = null;
	#camera: DOMMatrix = new DOMMatrix();
	#width: number = 0;
	#height: number = 0;
	#lastTime: number | null = null;
	#delta: number = NaN;
	#color: Color = Color.newBlack;
	#previous: string | null = null;
	#current: string | null = null;
	#next: string | null = null;
	#shake: number = 0.2;
	#lyrics: LyricsWindow | null = null;

	constructor(sabSignal: SharedArrayBuffer, sabMask: SharedArrayBuffer, sampleRate: number) {
		const signal = this.#signal = new Signal(sabSignal);
		this.#masks = new StemMasks(sabMask);
		this.#sampleRate = sampleRate;
		this.#frequency = signal.frequency.subarray(0, 0);
		this.#temporal = signal.temporal.subarray(0, 0);
	}

	//#region Audioset
	get length(): number { return this.#length; }
	get sampleRate(): number { return this.#sampleRate; }
	get time(): number { return this.#time; }
	get volume(): number { return this.#signal.volume * this.#masks.level(this.#length, this.#frequency); }
	get dataFrequency(): Float32Array { return this.#masks.mix(this.#length, this.#frequency); }
	get dataTemporal(): Float32Array { return this.#shapeWaveform(); }
	get dataDrums(): Float32Array { return this.#masks.drums(this.#length, this.#frequency); }
	get dataBass(): Float32Array { return this.#masks.bass(this.#length, this.#frequency); }
	get dataVocals(): Float32Array { return this.#masks.vocals(this.#length, this.#frequency); }
	get dataGuitar(): Float32Array { return this.#masks.guitar(this.#length, this.#frequency); }
	get dataKeys(): Float32Array { return this.#masks.keys(this.#length, this.#frequency); }
	get dataOther(): Float32Array { return this.#masks.other(this.#length, this.#frequency); }
	get spectralFlux(): number { return this.#analysis.spectralFlux; }
	get subBass(): number { return this.#analysis.subBass; }
	get bass(): number { return this.#analysis.bass; }
	get lowMid(): number { return this.#analysis.lowMid; }
	get mid(): number { return this.#analysis.mid; }
	get highMid(): number { return this.#analysis.highMid; }
	get high(): number { return this.#analysis.high; }
	get spectralCentroid(): number { return this.#analysis.spectralCentroid; }
	get percussiveness(): number { return this.#analysis.percussiveness; }
	get beatDetected(): boolean { return this.#analysis.beatDetected; }
	get dropIntensity(): number { return this.#analysis.dropIntensity; }
	get bassLevel(): number { return this.#analysis.bassLevel; }
	//#endregion
	//#region Environment
	get delta(): number { return this.#delta; }
	get colorBackground(): Color { return new Color(this.#color); }
	get lyrics(): LyricsWindow | null { return this.#lyrics; }
	//#endregion
	//#region Engine
	get frame(): number { return this.#signal.frame; }
	get width(): number { return this.#width; }
	get height(): number { return this.#height; }
	get camera(): DOMMatrix { return this.#camera; }
	get color(): Color { return this.#color; }

	/** The waveform scaled around its 0.5 centre by the share of the spectrum the stem gains keep: the masks can't split a waveform, so only its size follows them. `t × 1 + 0.5 × 0` is `t` exactly, so at every gain 1 it is the analyser's own waveform. */
	#shapeWaveform(): Float32Array {
		const level = this.#masks.level(this.#length, this.#frequency);
		const frame = this.#frame;
		if (level === this.#levelWaveform && frame === this.#frameWaveform) return this.#waveform;
		this.#levelWaveform = level;
		this.#frameWaveform = frame;
		const temporal = this.#temporal;
		const { length } = temporal;
		let waveform = this.#waveform;
		if (waveform.length !== length) waveform = this.#waveform = new Float32Array(length);
		const center = 0.5 * (1 - level);
		for (let index = 0; index < length; index++) waveform[index] = temporal[index] * level + center;
		return waveform;
	}

	#refreshLyrics(): void {
		const previous = this.#previous;
		const current = this.#current;
		const next = this.#next;
		if (previous === null && current === null && next === null) {
			this.#lyrics = null;
			return;
		}
		this.#lyrics = { previous, current, next, shake: this.#shake };
	}

	sync(): void {
		const signal = this.#signal;
		const frame = signal.frame;
		const length = signal.length;
		this.#masks.invalidate();
		if (frame === this.#frame) return;
		this.#frame = frame;
		if (1 > length || length > SabLayout.maxLength) return;
		if (length !== this.#length) {
			this.#length = length;
			this.#frequency = signal.frequency.subarray(0, length);
			this.#temporal = signal.temporal.subarray(0, length);
		}
		this.#time = signal.time;
		this.#masks.forget();
		this.#analysis.analyze(this.dataFrequency, this);
	}

	resize(width: number, height: number): void {
		this.#width = width;
		this.#height = height;
		this.#lastTime = performance.now() / 1000;
		this.#delta = 0;
	}

	tick(): void {
		const now = performance.now() / 1000;
		const lastTime = this.#lastTime;
		this.#delta = NaN;
		if (lastTime !== null) this.#delta = now - lastTime;
		this.#lastTime = now;
	}

	updateCamera(camera: DOMMatrix): void {
		this.#camera = camera;
	}

	updateColor(hue: number, saturation: number, lightness: number): void {
		this.#color = Color.fromHSL(hue, saturation, lightness);
	}

	updateLyrics(previous: string | null, current: string | null, next: string | null): void {
		this.#previous = previous;
		this.#current = current;
		this.#next = next;
		this.#refreshLyrics();
	}

	updateShake(value: number): void {
		this.#shake = value;
		this.#refreshLyrics();
	}

	/** One gain per stem, in the Audioset order: drums, bass, vocals, guitar, keys, other. */
	updateRatios(ratios: readonly number[]): void {
		const [drums, bass, vocals, guitar, keys, other] = ratios;
		this.#masks.weigh(drums, bass, vocals, guitar, keys, other);
	}
	//#endregion
}
//#endregion
