"use strict";

import "adaptive-extender/worker";
import { Color } from "adaptive-extender/worker";
import { Signal, Spectrum, StemMasks, Stems } from "../models/audio-features.js";
import { type AudiosetView, type VisualizationEnvironment, type LyricsView, LyricsWindow } from "../models/visualization.js";

//#region Worker audioset
export class WorkerAudioset implements AudiosetView {
	#signal: Signal;
	#features: Float32Array;
	#masks: StemMasks;
	#mix: Spectrum;
	#stems: Stems;
	#viewFrequency: Float32Array;
	#viewTemporal: Float32Array;
	#length: number = 0;

	constructor(sabSignal: SharedArrayBuffer, sabFeatures: SharedArrayBuffer, sabMask: SharedArrayBuffer) {
		const signal = this.#signal = new Signal(sabSignal);
		this.#features = new Float32Array(sabFeatures);
		const masks = this.#masks = new StemMasks(sabMask);
		this.#viewFrequency = signal.frequency.subarray(0, 0);
		this.#viewTemporal = signal.temporal.subarray(0, 0);
		this.#mix = new Spectrum(() => this.#viewFrequency);
		this.#stems = new Stems(masks, () => this.#length, () => this.#viewFrequency);
	}

	get frame(): number { return this.#signal.frame; }
	get length(): number { return this.#length; }
	get volume(): number { return this.#signal.volume; }
	get dataFrequency(): Float32Array { return this.#viewFrequency; }
	get dataTemporal(): Float32Array { return this.#viewTemporal; }
	get stems(): Stems { return this.#stems; }
	get energy(): number { return this.#mix.energy; }
	get spectralFlux(): number { return this.#mix.spectralFlux; }
	get subBass(): number { return this.#mix.subBass; }
	get bass(): number { return this.#mix.bass; }
	get lowMid(): number { return this.#mix.lowMid; }
	get mid(): number { return this.#mix.mid; }
	get highMid(): number { return this.#mix.highMid; }
	get high(): number { return this.#mix.high; }
	get spectralCentroid(): number { return this.#mix.spectralCentroid; }
	get percussiveness(): number { return this.#mix.percussiveness; }
	get beatDetected(): boolean { return this.#mix.beatDetected; }
	get dropIntensity(): number { return this.#mix.dropIntensity; }
	get bassLevel(): number { return this.#mix.bassLevel; }

	sync(): void {
		const signal = this.#signal;
		const features = this.#features;
		const length = signal.length;
		if (length !== this.#length) {
			this.#length = length;
			this.#viewFrequency = signal.frequency.subarray(0, length);
			this.#viewTemporal = signal.temporal.subarray(0, length);
		}
		this.#mix.readFrom(features, 0);
		this.#stems.readFrom(features);
		this.#masks.invalidate();
	}
}
//#endregion
//#region Worker environment
export class WorkerEnvironment implements VisualizationEnvironment {
	#lastTime: number = NaN;
	#delta: number = NaN;
	#previous: string | null = null;
	#current: string | null = null;
	#next: string | null = null;
	#shake: number = 0.2;
	#lyrics: LyricsView | null = null;
	#color: Color = Color.newBlack;

	#refreshLyrics(): void {
		const previous = this.#previous;
		const current = this.#current;
		const next = this.#next;
		if (previous === null && current === null && next === null) {
			this.#lyrics = null;
			return;
		}
		this.#lyrics = new LyricsWindow(previous, current, next, this.#shake);
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

	updateColor(hue: number, saturation: number, lightness: number): void {
		this.#color = Color.fromHSL(hue, saturation, lightness);
	}

	tick(): void {
		const now = performance.now() / 1000;
		const lastTime = this.#lastTime;
		this.#delta = NaN;
		if (Number.isFinite(lastTime)) this.#delta = now - lastTime;
		this.#lastTime = now;
	}

	reset(): void {
		this.#lastTime = performance.now() / 1000;
		this.#delta = 0;
	}

	get delta(): number { return this.#delta; }
	get colorBackground(): Color { return this.#color; }
	get lyrics(): LyricsView | null { return this.#lyrics; }
}
//#endregion
