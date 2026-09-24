"use strict";

import "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";

//#region Render bridge
export class RenderBridge {
	static #offsetFrequency: number = 28;
	static #offsetTemporal: number = RenderBridge.#offsetFrequency + SabLayout.inputMaxLength * 4;
	static byteSize(): number { return 28 + SabLayout.inputMaxLength * 8; }

	#sab: SharedArrayBuffer;
	#control: Int32Array;
	#metadata: Float32Array;
	#color: Float32Array;
	#frequency: Float32Array;
	#temporal: Float32Array;

	constructor() {
		const sab = this.#sab = new SharedArrayBuffer(RenderBridge.byteSize());
		this.#control = new Int32Array(sab, 0, 2);
		this.#metadata = new Float32Array(sab, 8, 2);
		this.#color = new Float32Array(sab, 16, 3);
		this.#frequency = new Float32Array(sab, RenderBridge.#offsetFrequency, SabLayout.inputMaxLength);
		this.#temporal = new Float32Array(sab, RenderBridge.#offsetTemporal, SabLayout.inputMaxLength);
	}

	get sab(): SharedArrayBuffer { return this.#sab; }
	get control(): Int32Array { return this.#control; }
	get metadata(): Float32Array { return this.#metadata; }
	get color(): Float32Array { return this.#color; }
	get frequency(): Float32Array { return this.#frequency; }
	get temporal(): Float32Array { return this.#temporal; }

	static offsetFrequency(): number { return RenderBridge.#offsetFrequency; }
	static offsetTemporal(): number { return RenderBridge.#offsetTemporal; }

	writeAudioset(length: number, volume: number, amplitude: number, dataFrequency: Float32Array, dataTemporal: Float32Array, hue: number, saturation: number, lightness: number): void {
		const metadata = this.#metadata;
		const color = this.#color;
		const control = this.#control;
		metadata[0] = volume;
		metadata[1] = amplitude;
		color[0] = hue;
		color[1] = saturation;
		color[2] = lightness;
		this.#frequency.set(dataFrequency);
		this.#temporal.set(dataTemporal);
		Atomics.store(control, 1, length);
		Atomics.add(control, 0, 1);
	}
}
//#endregion
