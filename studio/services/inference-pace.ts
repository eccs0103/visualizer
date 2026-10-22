"use strict";

import "adaptive-extender/worker";

const { max, min, round } = Math;

//#region Inference budget
export class InferenceBudget {
	static #free: number = 0.1;
	static #climb: number = 0.01;
	static #trial: number = 2;

	#others: number = 0;
	#cut: number | null = null;
	#checks: number = 0;
	#excused: boolean = false;

	get value(): number {
		if (this.#cut !== null) return 0;
		return 1 - InferenceBudget.#free - this.#others;
	}

	adapt(lagging: boolean, share: number | null): void {
		const cut = this.#cut;
		if (cut !== null) return this.#check(lagging, cut);
		if (!lagging) return this.#recover();
		if (this.#excused || share === null) return;
		this.#cut = 1 - share;
		this.#checks = InferenceBudget.#trial;
	}

	#check(lagging: boolean, cut: number): void {
		if (lagging) {
			this.#cut = null;
			this.#excused = true;
			return;
		}
		if (--this.#checks > 0) return;
		this.#others = cut;
		this.#cut = null;
	}

	#recover(): void {
		this.#excused = false;
		this.#others = max(this.#others - InferenceBudget.#climb, 0);
	}
}
//#endregion
//#region Inference pace
export class InferencePace {
	static #longest: number = 1000;
	static #acceptable: number = 100;
	static #tolerance: number = 0.75;
	static #learning: number = 0.2;
	static #length: number = 1000;
	static #gap: number = 2000;

	#budget: InferenceBudget;
	#cost: number | null = null;
	#started: number | null = null;
	#opened: number | null = null;
	#count: number = 0;
	#rate: number | null = null;
	#spent: number = 0;
	#since: number | null = null;

	constructor(budget: InferenceBudget) {
		this.#budget = budget;
	}

	get rate(): number | null { return this.#rate; }

	share(now: number): number | null {
		const since = this.#since, spent = this.#spent;
		this.#since = now;
		this.#spent = 0;
		if (since === null) return null;
		return spent / (now - since);
	}

	get slowed(): boolean {
		const cost = this.#cost;
		if (cost === null) return false;
		return this.#wait(cost) > InferencePace.#acceptable / InferencePace.#tolerance;
	}

	ready(now: number): boolean {
		const cost = this.#cost, started = this.#started;
		if (cost === null || started === null) return true;
		return now - started >= this.#wait(cost);
	}

	start(now: number): void {
		this.#started = now;
	}

	finish(spent: number, now: number): boolean {
		if (this.#started === null) throw new ReferenceError("No inference was started");
		const cost = this.#cost;
		this.#cost = cost === null ? spent : cost + (spent - cost) * InferencePace.#learning;
		this.#spent += spent;

		const opened = this.#opened;
		if (opened === null || now - opened > InferencePace.#gap) {
			this.#open(now);
			return false;
		}
		const count = ++this.#count;
		const elapsed = now - opened;
		if (elapsed < InferencePace.#length) return false;
		this.#open(now);
		this.#rate = round(count * 1000 / elapsed);
		return true;
	}

	#wait(cost: number): number {
		return min(cost / max(this.#budget.value, 0), InferencePace.#longest);
	}

	#open(now: number): void {
		this.#opened = now;
		this.#count = 0;
	}
}
//#endregion
