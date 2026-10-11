"use strict";

import "adaptive-extender/web";

//#region Model tap
/** The splitter's own view of the audio: an analyser fixed to what the model was trained on (FFT size 1024, smoothing 0.6, −90…−30 dB), fed straight from the source, so no visual setting ever changes what the AI hears. */
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

	/** Reads the analyser into `model`, one value per bin from 0 to 1. */
	capture(model: Float32Array): void {
		const bytes = this.#bytes;
		this.#analyser.getByteFrequencyData(bytes);
		for (let index = 0; index < bytes.length; index++) model[index] = bytes[index] / 255;
	}
}
//#endregion
