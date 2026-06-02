"use strict";

import "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";

//#region Render bridge
export class RenderBridge {
	static #frequencyOffset: number = 28;
	static #temporalOffset: number = RenderBridge.#frequencyOffset + SabLayout.inputMaxLength * 4;
	static byteSize(): number { return 28 + SabLayout.inputMaxLength * 8; }

	#sab: SharedArrayBuffer;
	#control: Int32Array;
	#metadata: Float32Array;
	#color: Float32Array;
	#frequency: Float32Array;
	#temporal: Float32Array;

	constructor() {
		this.#sab = new SharedArrayBuffer(RenderBridge.byteSize());
		this.#control = new Int32Array(this.#sab, 0, 2);
		this.#metadata = new Float32Array(this.#sab, 8, 2);
		this.#color = new Float32Array(this.#sab, 16, 3);
		this.#frequency = new Float32Array(this.#sab, RenderBridge.#frequencyOffset, SabLayout.inputMaxLength);
		this.#temporal = new Float32Array(this.#sab, RenderBridge.#temporalOffset, SabLayout.inputMaxLength);
	}

	get sab(): SharedArrayBuffer { return this.#sab; }
	get control(): Int32Array { return this.#control; }
	get metadata(): Float32Array { return this.#metadata; }
	get color(): Float32Array { return this.#color; }
	get frequency(): Float32Array { return this.#frequency; }
	get temporal(): Float32Array { return this.#temporal; }

	static frequencyOffset(): number { return RenderBridge.#frequencyOffset; }
	static temporalOffset(): number { return RenderBridge.#temporalOffset; }

	writeAudioset(length: number, volume: number, amplitude: number, dataFrequency: Float32Array, dataTemporal: Float32Array, colorH: number, colorS: number, colorL: number): void {
		this.#metadata[0] = volume;
		this.#metadata[1] = amplitude;
		this.#color[0] = colorH;
		this.#color[1] = colorS;
		this.#color[2] = colorL;
		this.#frequency.set(dataFrequency);
		this.#temporal.set(dataTemporal);
		Atomics.store(this.#control, 1, length);
		Atomics.add(this.#control, 0, 1);
	}
}
//#endregion
