"use strict";

import "adaptive-extender/worker";
import { Color } from "adaptive-extender/worker";
import { SabLayout, Signal } from "../models/audio-features.js";
import { Stem, type StemGains } from "../models/stem.js";
import { type Audioset, type Environment, type LyricsWindow } from "../models/visualization.js";
import { SpectrumAnalysis } from "./visualization-tools.js";
import { StemFrame } from "./stem-frame.js";
import { LyricsFrame } from "./lyrics-frame.js";

//#region Stage
export class Stage implements Audioset, Environment {
	#signal: Signal;
	#stems: StemFrame;
	#sampleRate: number;
	#analysis: SpectrumAnalysis = new SpectrumAnalysis();
	#frame: number | null = null;
	#length: number = 0;
	#time: number = NaN;
	#frequency: Float32Array;
	#temporal: Float32Array;
	#camera: DOMMatrix = new DOMMatrix();
	#width: number = 0;
	#height: number = 0;
	#lastTime: number | null = null;
	#delta: number = NaN;
	#color: Color = Color.newBlack;
	#lyrics: LyricsFrame = new LyricsFrame();

	constructor(sabSignal: SharedArrayBuffer, sabMask: SharedArrayBuffer, sampleRate: number) {
		const signal = this.#signal = new Signal(sabSignal);
		this.#stems = new StemFrame(sabMask);
		this.#sampleRate = sampleRate;
		this.#frequency = signal.frequency.subarray(0, 0);
		this.#temporal = signal.temporal.subarray(0, 0);
	}

	//#region Audioset
	get length(): number { return this.#length; }
	get sampleRate(): number { return this.#sampleRate; }
	get time(): number { return this.#time; }
	get volume(): number { return this.#signal.volume * this.#stems.level; }
	get dataFrequency(): Float32Array { return this.#stems.mix; }
	get dataTemporal(): Float32Array { return this.#stems.waveform; }
	get dataDrums(): Float32Array { return this.#stems.spectrum(Stem.drums); }
	get dataBass(): Float32Array { return this.#stems.spectrum(Stem.bass); }
	get dataVocals(): Float32Array { return this.#stems.spectrum(Stem.vocals); }
	get dataGuitar(): Float32Array { return this.#stems.spectrum(Stem.guitar); }
	get dataKeys(): Float32Array { return this.#stems.spectrum(Stem.keys); }
	get dataOther(): Float32Array { return this.#stems.spectrum(Stem.other); }
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

	get lyrics(): LyricsWindow | null {
		const lyrics = this.#lyrics;
		if (lyrics.isEmpty) return null;
		return lyrics;
	}
	//#endregion
	//#region Engine
	get frame(): number { return this.#signal.frame; }
	get width(): number { return this.#width; }
	get height(): number { return this.#height; }
	get camera(): DOMMatrix { return this.#camera; }
	get color(): Color { return this.#color; }

	sync(): void {
		const signal = this.#signal;
		const stems = this.#stems;
		const frame = signal.frame;
		const length = signal.length;
		stems.invalidate();
		if (frame === this.#frame) return;
		this.#frame = frame;
		if (1 > length || length > SabLayout.maxLength) return;
		if (length !== this.#length) {
			this.#length = length;
			this.#frequency = signal.frequency.subarray(0, length);
			this.#temporal = signal.temporal.subarray(0, length);
		}
		this.#time = signal.time;
		stems.load(this.#frequency, this.#temporal);
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

	updateClock(position: number): void {
		this.#lyrics.tick(position);
	}

	updateLyrics(previous: string | null, current: string | null, next: string | null, begin: number | null, end: number | null): void {
		this.#lyrics.update(previous, current, next, begin, end);
	}

	updateShake(value: number): void {
		this.#lyrics.shake = value;
	}

	updateGains(gains: StemGains): void {
		this.#stems.weigh(gains);
	}

	finish(): void {
		this.#signal.finish();
	}
	//#endregion
}
//#endregion
