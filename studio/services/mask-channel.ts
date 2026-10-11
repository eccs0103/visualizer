"use strict";

import "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";

const { min } = Math;

//#region Mask channel
/** The shared memory the AI worker publishes its masks through and the render worker reads them from: a version counter, the time of the last publication and the gap before it, then the previous and the current masks (`bins` rows of `stems` each). */
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

	/** A fresh channel at the uniform 1/stems prior — an honest "no separation yet", not zeros. */
	static createBuffer(): SharedArrayBuffer {
		const sab = new SharedArrayBuffer(24 + SabLayout.bins * SabLayout.stems * 4 * 2);
		new Float32Array(sab, 24).fill(1 / SabLayout.stems);
		return sab;
	}

	/** Counts the publications. */
	get version(): number { return Atomics.load(this.#control, 0); }

	get previous(): Float32Array { return this.#previous; }
	get current(): Float32Array { return this.#current; }

	/** How far the blend from the previous to the current masks has come at `now` (epoch ms): 0 at the last publication, 1 a gap later. */
	weight(now: number): number {
		const [stamp, interval] = this.#timing;
		if (interval <= 0) return 1;
		return ((now - stamp) / interval).clamp(0, 1);
	}

	/** AI worker only: `masks` becomes the current masks, the old current ones become the previous, and `now` (epoch ms) starts the blend between them. */
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
