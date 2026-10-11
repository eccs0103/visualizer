"use strict";

import "adaptive-extender/worker";

const { round } = Math;

//#region Inference pace
/**
 * Keeps the splitter's share of the GPU under a budget (40%: on an Intel UHD 630 even 100% cost one dropped frame in 3 s), because on an integrated GPU the same chip also draws the visuals: it measures what one inference costs and lets the next one start only after `cost / budget` since the last start, so a weak GPU slows the AI down instead of the visuals. A strong GPU never hits the budget and keeps the normal pace. It also measures how many inferences finish per second.
 */
export class InferencePace {
	static #budget: number = 0.4;
	static #tolerance: number = 0.75;
	static #learning: number = 0.2;
	static #window: number = 1000;
	static #gap: number = 2000;

	#cost: number | null = null;
	#started: number | null = null;
	#opened: number | null = null;
	#count: number = 0;
	#rate: number | null = null;

	/** Inferences finished per second over the last measured window; `null` until the first window closes. */
	get rate(): number | null { return this.#rate; }

	/** Whether the budget holds the AI clearly below its normal pace (`period` ms between inferences): under `tolerance` of it, so the answer doesn't flicker near the edge. */
	slowed(period: number): boolean {
		const cost = this.#cost;
		if (cost === null) return false;
		return cost / InferencePace.#budget > period / InferencePace.#tolerance;
	}

	ready(now: number): boolean {
		const cost = this.#cost, started = this.#started;
		if (cost === null || started === null) return true;
		return now - started >= cost / InferencePace.#budget;
	}

	start(now: number): void {
		this.#started = now;
	}

	/** Records the inference that started last; returns whether that closed a window with a new `rate`. */
	finish(now: number): boolean {
		const started = this.#started;
		if (started === null) throw new ReferenceError("No inference was started");
		const cost = this.#cost;
		const spent = now - started;
		this.#cost = cost === null ? spent : cost + (spent - cost) * InferencePace.#learning;

		const opened = this.#opened;
		if (opened === null || now - opened > InferencePace.#gap) {
			this.#open(now);
			return false;
		}
		const count = ++this.#count;
		const elapsed = now - opened;
		if (elapsed < InferencePace.#window) return false;
		this.#rate = round(count * 1000 / elapsed);
		this.#open(now);
		return true;
	}

	#open(now: number): void {
		this.#opened = now;
		this.#count = 0;
	}
}
//#endregion
