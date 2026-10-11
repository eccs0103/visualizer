"use strict";

import "adaptive-extender/web";

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

	capture(model: Float32Array): void {
		const bytes = this.#bytes;
		this.#analyser.getByteFrequencyData(bytes);
		for (let index = 0; index < bytes.length; index++) model[index] = bytes[index] / 255;
	}
}
//#endregion
