"use strict";

import "adaptive-extender/worker";
import { Color } from "adaptive-extender/worker";
import { AudioFeatures, SabLayout } from "../models/audio-features.js";
import { type AudiosetView, type VisualizationEnvironment } from "../models/visualization.js";
import { RenderBridge } from "./render-bridge.js";

//#region Worker audioset
export class WorkerAudioset implements AudiosetView {
	#control: Int32Array;
	#metadata: Float32Array;
	#color: Float32Array;
	#frequency: Float32Array;
	#temporal: Float32Array;
	#features: AudioFeatures = new AudioFeatures();
	#bufferFeatures: Float32Array;
	#length: number = 0;

	constructor(sabVideo: SharedArrayBuffer, sabAudio: SharedArrayBuffer) {
		this.#control = new Int32Array(sabVideo, 0, 2);
		this.#metadata = new Float32Array(sabVideo, 8, 2);
		this.#color = new Float32Array(sabVideo, 16, 3);
		this.#frequency = new Float32Array(sabVideo, RenderBridge.frequencyOffset(), SabLayout.inputMaxLength);
		this.#temporal = new Float32Array(sabVideo, RenderBridge.temporalOffset(), SabLayout.inputMaxLength);
		this.#bufferFeatures = new Float32Array(sabAudio);
	}

	get length(): number { return this.#length; }
	get volume(): number { return this.#metadata[0]; }
	get amplitude(): number { return this.#metadata[1]; }
	get dataFrequency(): Float32Array { return this.#frequency.subarray(0, this.#length); }
	get dataTemporal(): Float32Array { return this.#temporal.subarray(0, this.#length); }
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

	get colorH(): number { return this.#color[0]; }
	get colorS(): number { return this.#color[1]; }
	get colorL(): number { return this.#color[2]; }

	sync(): void {
		this.#length = Atomics.load(this.#control, 1);
		this.#features.readFrom(this.#bufferFeatures);
	}
}
//#endregion
//#region Worker environment
export class WorkerEnvironment implements VisualizationEnvironment {
	#audioset: WorkerAudioset;
	#lastTime: number = NaN;
	#delta: number = NaN;

	constructor(audioset: WorkerAudioset) {
		this.#audioset = audioset;
	}

	tick(): void {
		const now = performance.now() / 1000;
		this.#delta = Number.isFinite(this.#lastTime) ? now - this.#lastTime : NaN;
		this.#lastTime = now;
	}

	reset(): void {
		this.#lastTime = performance.now() / 1000;
		this.#delta = 0;
	}

	get isLaunched(): boolean { return true; }
	get delta(): number { return this.#delta; }

	get fps(): number {
		return Number.isFinite(this.#delta) && this.#delta > 0
			? 1 / this.#delta
			: 0;
	}

	get colorBackground(): Color {
		const { colorH, colorS, colorL } = this.#audioset;
		return Color.fromHSL(colorH, colorS, colorL);
	}
}
//#endregion
