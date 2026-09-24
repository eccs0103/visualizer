"use strict";

import "adaptive-extender/worker";
import { Color } from "adaptive-extender/worker";
import { AudioFeatures, SabLayout } from "../models/audio-features.js";
import { type AudiosetView, type VisualizationEnvironment, type LyricsView, LyricsWindow } from "../models/visualization.js";
import { RenderBridge } from "./render-bridge.js";

//#region Worker audioset
export class WorkerAudioset implements AudiosetView {
	#control: Int32Array;
	#metadata: Float32Array;
	#color: Float32Array;
	#frequency: Float32Array;
	#temporal: Float32Array;
	#viewFrequency: Float32Array;
	#viewTemporal: Float32Array;
	#features: AudioFeatures = new AudioFeatures();
	#bufferFeatures: Float32Array;
	#length: number = 0;

	constructor(sabVideo: SharedArrayBuffer, sabAudio: SharedArrayBuffer) {
		this.#control = new Int32Array(sabVideo, 0, 2);
		this.#metadata = new Float32Array(sabVideo, 8, 2);
		this.#color = new Float32Array(sabVideo, 16, 3);
		this.#frequency = new Float32Array(sabVideo, RenderBridge.offsetFrequency(), SabLayout.inputMaxLength);
		this.#temporal = new Float32Array(sabVideo, RenderBridge.offsetTemporal(), SabLayout.inputMaxLength);
		this.#viewFrequency = this.#frequency.subarray(0, 0);
		this.#viewTemporal = this.#temporal.subarray(0, 0);
		this.#bufferFeatures = new Float32Array(sabAudio);
	}

	get frame(): number { return Atomics.load(this.#control, 0); }
	get length(): number { return this.#length; }
	get volume(): number { return this.#metadata[0]; }
	get amplitude(): number { return this.#metadata[1]; }
	get dataFrequency(): Float32Array { return this.#viewFrequency; }
	get dataTemporal(): Float32Array { return this.#viewTemporal; }
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

	get hue(): number { return this.#color[0]; }
	get saturation(): number { return this.#color[1]; }
	get lightness(): number { return this.#color[2]; }

	sync(): void {
		const length = Atomics.load(this.#control, 1);
		if (length !== this.#length) {
			this.#length = length;
			this.#viewFrequency = this.#frequency.subarray(0, length);
			this.#viewTemporal = this.#temporal.subarray(0, length);
		}
		this.#features.readFrom(this.#bufferFeatures);
	}
}
//#endregion
//#region Worker environment
export class WorkerEnvironment implements VisualizationEnvironment {
	#audioset: WorkerAudioset;
	#lastTime: number = NaN;
	#delta: number = NaN;
	#previous: string | null = null;
	#current: string | null = null;
	#next: string | null = null;
	#shake: number = 0.2;
	#lyrics: LyricsView | null = null;
	#color: Color | null = null;
	#hue: number = NaN;
	#saturation: number = NaN;
	#lightness: number = NaN;

	constructor(audioset: WorkerAudioset) {
		this.#audioset = audioset;
	}

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

	get isLaunched(): boolean { return true; }
	get delta(): number { return this.#delta; }

	get fps(): number {
		const delta = this.#delta;
		if (Number.isFinite(delta) && delta > 0) return 1 / delta;
		return 0;
	}

	get colorBackground(): Color {
		const { hue, saturation, lightness } = this.#audioset;
		const cached = this.#color;
		if (cached !== null && hue === this.#hue && saturation === this.#saturation && lightness === this.#lightness) return cached;
		const color = Color.fromHSL(hue, saturation, lightness);
		this.#color = color;
		this.#hue = hue;
		this.#saturation = saturation;
		this.#lightness = lightness;
		return color;
	}

	get lyrics(): LyricsView | null { return this.#lyrics; }
}
//#endregion
