"use strict";

import "adaptive-extender/worker";
import { RateWindow } from "./rate-window.js";

//#region Inference pace
export class InferencePace {
	static #budget: number = 0.4;
	static #acceptable: number = 100;
	static #tolerance: number = 0.75;
	static #learning: number = 0.2;
	static #length: number = 1000;
	static #gap: number = 2000;

	#cost: number | null = null;
	#started: number | null = null;
	#window: RateWindow = new RateWindow(InferencePace.#length);
	#rate: number | null = null;

	get rate(): number | null { return this.#rate; }

	get slowed(): boolean {
		const cost = this.#cost;
		if (cost === null) return false;
		return cost / InferencePace.#budget > InferencePace.#acceptable / InferencePace.#tolerance;
	}

	ready(now: number): boolean {
		const cost = this.#cost, started = this.#started;
		if (cost === null || started === null) return true;
		return now - started >= cost / InferencePace.#budget;
	}

	start(now: number): void {
		this.#started = now;
	}

	finish(spent: number, now: number): boolean {
		if (this.#started === null) throw new ReferenceError("No inference was started");
		const cost = this.#cost;
		this.#cost = cost === null ? spent : cost + (spent - cost) * InferencePace.#learning;

		const window = this.#window;
		if (window.idle(now, InferencePace.#gap)) window.reset();
		const rate = window.count(now);
		if (rate === null) return false;
		this.#rate = rate;
		return true;
	}
}
//#endregion
