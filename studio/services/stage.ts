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
	#frame: number = -1;
	#length: number = 0;
	#time: number = NaN;
	#frequency: Float32Array;
	#temporal: Float32Array;
	#camera: DOMMatrix = new DOMMatrix();
	#width: number = 0;
	#height: number = 0;
	#lastTime: number = NaN;
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
	get volume(): number { return this.#signal.volume; }
	get dataFrequency(): Float32Array { return this.#frequency; }
	get dataTemporal(): Float32Array { return this.#temporal; }
	get dataDrums(): Float32Array { return this.#masks.drums(this.#length, this.#frequency); }
	get dataBass(): Float32Array { return this.#masks.bass(this.#length, this.#frequency); }
	get dataVocals(): Float32Array { return this.#masks.vocals(this.#length, this.#frequency); }
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
		this.#analysis.analyze(this.#frequency, this);
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
		if (Number.isFinite(lastTime)) this.#delta = now - lastTime;
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
	//#endregion
}
//#endregion
