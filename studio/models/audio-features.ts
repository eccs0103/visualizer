"use strict";

import "adaptive-extender/core";
import { Stems } from "./stem.js";

const { min } = Math;

//#region SAB layout
export class SabLayout {
	static #maxLength: number = 16384;
	static #bins: number = 512;

	static get maxLength(): number { return SabLayout.#maxLength; }
	static get bins(): number { return SabLayout.#bins; }
	static get stems(): number { return Stems.all.length; }
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
//#region Mask channel
export class MaskChannel {
	static #ceiling: number = 500; // ms — a longer gap (paused audio) must not stretch the next blend

	#sab: SharedArrayBuffer;
	#control: Int32Array;
	#timing: Float64Array;
	#previous: Float32Array;
	#current: Float32Array;

	constructor(sab: SharedArrayBuffer) {
		const size = SabLayout.bins * SabLayout.stems;
		this.#sab = sab;
		this.#control = new Int32Array(sab, 0, 1);
		this.#timing = new Float64Array(sab, 8, 2);
		this.#previous = new Float32Array(sab, 24, size);
		this.#current = new Float32Array(sab, 24 + size * 4, size);
	}

	static create(): MaskChannel {
		const sab = new SharedArrayBuffer(24 + SabLayout.bins * SabLayout.stems * 4 * 2);
		new Float32Array(sab, 24).fill(1 / SabLayout.stems);
		return new MaskChannel(sab);
	}

	get sab(): SharedArrayBuffer { return this.#sab; }
	get version(): number { return Atomics.load(this.#control, 0); }
	get previous(): Float32Array { return this.#previous; }
	get current(): Float32Array { return this.#current; }

	weight(now: number): number {
		const [stamp, interval] = this.#timing;
		if (interval <= 0) return 1;
		return ((now - stamp) / interval).clamp(0, 1);
	}

	publish(masks: Float32Array, now: number): void {
		const timing = this.#timing;
		const current = this.#current;
		this.#previous.set(current);
		current.set(masks);
		const stamp = timing[0];
		let interval = 0;
		if (stamp !== 0) interval = min(now - stamp, MaskChannel.#ceiling);
		timing[1] = interval;
		timing[0] = now;
		Atomics.add(this.#control, 0, 1);
	}
}
//#endregion
