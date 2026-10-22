"use strict";

import "adaptive-extender/worker";

const { max, min, round, trunc } = Math;

//#region Inference budget
export class InferenceBudget {
	static #free: number = 0.1;
	static #climb: number = 0.01;
	static #trial: number = 2;
	static #proof: number = 0.1;
	static #history: number = 5;
	static #rest: number = 10;
	static #patience: number = 320;

	#others: number = 0;
	#losses: number[] = [];
	#cut: number | null = null;
	#before: number = 0;
	#during: number[] = [];
	#backoff: number = InferenceBudget.#rest;
	#waiting: number = 0;

	get value(): number {
		if (this.#cut !== null) return 0;
		return 1 - InferenceBudget.#free - this.#others;
	}

	static #mean(values: readonly number[]): number {
		let sum = 0;
		for (const value of values) sum += value;
		return sum / values.length;
	}

	static #median(values: readonly number[]): number {
		return values.toSorted((value, value2) => value - value2)[trunc(values.length / 2)];
	}

	adapt(loss: number, share: number | null): void {
		const cut = this.#cut;
		if (cut !== null) return this.#check(loss, cut);
		const proof = InferenceBudget.#proof;
		const losses = this.#losses;
		losses.push(loss);
		if (losses.length > InferenceBudget.#history) losses.shift();
		if (this.#waiting > 0) {
			this.#waiting--;
			return;
		}
		if (loss < proof) this.#others = max(this.#others - InferenceBudget.#climb, 0);
		if (losses.length < InferenceBudget.#history || share === null) return;
		const before = InferenceBudget.#median(losses);
		if (before < proof) return;
		this.#cut = 1 - share;
		this.#before = before;
		this.#during = [];
	}

	#check(loss: number, cut: number): void {
		const during = this.#during;
		during.push(loss);
		if (during.length < InferenceBudget.#trial) return;
		const backoff = this.#backoff;
		this.#cut = null;
		this.#losses = [];
		this.#waiting = backoff;
		this.#backoff = min(backoff * 2, InferenceBudget.#patience);
		if (this.#before - InferenceBudget.#mean(during) > InferenceBudget.#proof) this.#others = cut;
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
