"use strict";

import { SabLayout } from "../models/audio-features.js";

//#region Feature bridge
export class FeatureBridge {
	#inSAB: SharedArrayBuffer;
	#outSAB: SharedArrayBuffer;

	#inCtrl: Int32Array;
	#inMeta: Float32Array;
	#inFreq: Float32Array;
	#inTemp: Float32Array;
	#out: Float32Array;

	constructor() {
		this.#inSAB = new SharedArrayBuffer(SabLayout.inputByteSize());
		this.#outSAB = new SharedArrayBuffer(SabLayout.outputSize * 4);

		this.#inCtrl = new Int32Array(this.#inSAB, 0, 2);
		this.#inMeta = new Float32Array(this.#inSAB, 8, 3);
		this.#inFreq = new Float32Array(this.#inSAB, 20, SabLayout.inputMaxLength);
		this.#inTemp = new Float32Array(this.#inSAB, 20 + SabLayout.inputMaxLength * 4, SabLayout.inputMaxLength);
		this.#out = new Float32Array(this.#outSAB);
	}

	get inSAB(): SharedArrayBuffer { return this.#inSAB; }
	get outSAB(): SharedArrayBuffer { return this.#outSAB; }
	get output(): Float32Array { return this.#out; }

	writeInput(length: number, sampleRate: number, normVolume: number, normAmplitude: number, normsDataFrequency: Float32Array, normsDataTemporal: Float32Array): void {
		this.#inMeta[0] = sampleRate;
		this.#inMeta[1] = normVolume;
		this.#inMeta[2] = normAmplitude;
		this.#inFreq.set(normsDataFrequency);
		this.#inTemp.set(normsDataTemporal);
		Atomics.store(this.#inCtrl, 1, length);
		Atomics.add(this.#inCtrl, 0, 1);
	}

}
//#endregion
