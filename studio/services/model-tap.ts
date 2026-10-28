"use strict";

import "adaptive-extender/web";
import { type StemGrid } from "../models/stem-weights.js";

//#region Model tap
export class ModelTap {
	static #size: number = 1024;
	static #smoothing: number = 0.6;
	static #floor: number = -90;
	static #ceiling: number = -30;

	#analyser: AnalyserNode;
	#bytes: Uint8Array<ArrayBuffer>;

	constructor(context: AudioContext, source: AudioNode) {
		const analyser = this.#analyser = context.createAnalyser();
		analyser.fftSize = ModelTap.#size;
		analyser.smoothingTimeConstant = ModelTap.#smoothing;
		analyser.minDecibels = ModelTap.#floor;
		analyser.maxDecibels = ModelTap.#ceiling;
		source.connect(analyser);
		this.#bytes = new Uint8Array(analyser.frequencyBinCount);
	}

	capture(model: Float32Array, grid: StemGrid): void {
		const analyser = this.#analyser;
		let bytes = this.#bytes;
		if (analyser.fftSize !== grid.size) {
			analyser.fftSize = grid.size;
			bytes = this.#bytes = new Uint8Array(analyser.frequencyBinCount);
		}
		analyser.getByteFrequencyData(bytes);
		grid.merge(bytes, model);
	}
}
//#endregion
