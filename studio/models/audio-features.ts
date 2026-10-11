"use strict";

import "adaptive-extender/core";
import { Stems } from "./stem.js";

//#region SAB layout
export class SabLayout {
	static #maxLength: number = 16384;
	static #bins: number = 512;

	static get maxLength(): number { return SabLayout.#maxLength; }
	static get bins(): number { return SabLayout.#bins; }
	static get stems(): number { return Stems.count; }
}
//#endregion
//#region Signal
export class Signal {
	#sab: SharedArrayBuffer;
	#control: Int32Array;
	#time: Float64Array;
	#volume: Float32Array;
	#frequency: Float32Array;
	#temporal: Float32Array;
	#model: Float32Array;

	constructor(sab: SharedArrayBuffer) {
		const maxLength = SabLayout.maxLength;
		this.#sab = sab;
		this.#control = new Int32Array(sab, 0, 2);
		this.#time = new Float64Array(sab, 8, 1);
		this.#volume = new Float32Array(sab, 16, 1);
		this.#frequency = new Float32Array(sab, 24, maxLength);
		this.#temporal = new Float32Array(sab, 24 + maxLength * 4, maxLength);
		this.#model = new Float32Array(sab, 24 + maxLength * 8, SabLayout.bins);
	}

	static create(): Signal {
		return new Signal(new SharedArrayBuffer(24 + SabLayout.maxLength * 4 * 2 + SabLayout.bins * 4));
	}

	get sab(): SharedArrayBuffer { return this.#sab; }
	get frame(): number { return Atomics.load(this.#control, 0); }
	get length(): number { return Atomics.load(this.#control, 1); }
	get time(): number { return this.#time[0]; }
	get volume(): number { return this.#volume[0]; }
	get frequency(): Float32Array { return this.#frequency; }
	get temporal(): Float32Array { return this.#temporal; }
	get model(): Float32Array { return this.#model; }

	publish(length: number, volume: number, time: number): void {
		const control = this.#control;
		this.#volume[0] = volume;
		this.#time[0] = time;
		Atomics.store(control, 1, length);
		Atomics.add(control, 0, 1);
	}
}
//#endregion
