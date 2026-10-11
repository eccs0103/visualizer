"use strict";

import "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";

const { min } = Math;

//#region Mask channel
export class MaskChannel {
	static #ceiling: number = 500; // ms — a longer gap (paused audio) must not stretch the next blend

	#control: Int32Array;
	#timing: Float64Array;
	#previous: Float32Array;
	#current: Float32Array;

	constructor(sab: SharedArrayBuffer) {
		const size = SabLayout.bins * SabLayout.stems;
		this.#control = new Int32Array(sab, 0, 1);
		this.#timing = new Float64Array(sab, 8, 2);
		this.#previous = new Float32Array(sab, 24, size);
		this.#current = new Float32Array(sab, 24 + size * 4, size);
	}

	static createBuffer(): SharedArrayBuffer {
		const sab = new SharedArrayBuffer(24 + SabLayout.bins * SabLayout.stems * 4 * 2);
		new Float32Array(sab, 24).fill(1 / SabLayout.stems);
		return sab;
	}

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
