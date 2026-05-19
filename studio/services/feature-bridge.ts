"use strict";

import { SabLayout } from "../models/audio-features.js";

//#region Feature bridge
export class FeatureBridge {
	#inSAB: SharedArrayBuffer;
	#outSAB: SharedArrayBuffer;

	#inControl: Int32Array;
	#inMetadata: Float32Array;
	#inFrequency: Float32Array;
	#inTemporal: Float32Array;
	#out: Float32Array;

	constructor() {
		this.#inSAB = new SharedArrayBuffer(SabLayout.inputByteSize());
		this.#outSAB = new SharedArrayBuffer(SabLayout.outputSize * 4);

		this.#inControl = new Int32Array(this.#inSAB, 0, 2);
		this.#inMetadata = new Float32Array(this.#inSAB, 8, 3);
		this.#inFrequency = new Float32Array(this.#inSAB, 20, SabLayout.inputMaxLength);
		this.#inTemporal = new Float32Array(this.#inSAB, 20 + SabLayout.inputMaxLength * 4, SabLayout.inputMaxLength);
		this.#out = new Float32Array(this.#outSAB);
	}

	get inSAB(): SharedArrayBuffer { return this.#inSAB; }
	get outSAB(): SharedArrayBuffer { return this.#outSAB; }
	get output(): Float32Array { return this.#out; }

	writeInput(length: number, sampleRate: number, normVolume: number, normAmplitude: number, normsDataFrequency: Float32Array, normsDataTemporal: Float32Array): void {
		this.#inMetadata[0] = sampleRate;
		this.#inMetadata[1] = normVolume;
		this.#inMetadata[2] = normAmplitude;
		this.#inFrequency.set(normsDataFrequency);
		this.#inTemporal.set(normsDataTemporal);
		Atomics.store(this.#inControl, 1, length);
		Atomics.add(this.#inControl, 0, 1);
	}

}
//#endregion
