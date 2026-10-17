"use strict";

import "adaptive-extender/core";

const { round } = Math;

//#region Rate window
export class RateWindow {
	#length: number;
	#opened: number | null = null;
	#count: number = 0;

	constructor(length: number) {
		this.#length = length;
	}

	idle(now: number, gap: number): boolean {
		const opened = this.#opened;
		return opened !== null && now - opened > gap;
	}

	reset(): void {
		this.#opened = null;
	}

	count(now: number): number | null {
		const opened = this.#opened;
		if (opened === null) {
			this.#open(now);
			return null;
		}
		const count = ++this.#count;
		const elapsed = now - opened;
		if (elapsed < this.#length) return null;
		this.#open(now);
		return round(count * 1000 / elapsed);
	}

	#open(now: number): void {
		this.#opened = now;
		this.#count = 0;
	}
}
//#endregion
