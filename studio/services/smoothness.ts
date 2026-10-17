"use strict";

import "adaptive-extender/web";
import { type Visualizer } from "./visualizer.js";

const { max, min, round, trunc } = Math;

//#region Frame rate
export class FrameRate {
	#fps: number;
	#normal: number;

	constructor(fps: number, normal: number) {
		this.#fps = fps;
		this.#normal = normal;
	}

	get fps(): number { return this.#fps; }

	get summary(): string {
		return `${this.#fps} of ${this.#normal}\nframes/s`;
	}

	falls(share: number): boolean {
		return this.#fps < this.#normal * share;
	}
}
//#endregion
//#region Smoothness
export interface SmoothnessEventMap {
	"measure": CustomEvent<FrameRate>;
	"change": Event;
}

export class Smoothness extends EventTarget {
	static #length: number = 1000;
	static #share: number = 0.8;
	static #freeze: number = 100;
	static #hold: number = 3000;
	static #warmup: number = 2000;
	static #memory: number = 60;

	#visualizer: Visualizer;
	#screens: number[] = [];
	#clock: number = 0;
	#started: number | null = null;
	#rate: number = 0;
	#opened: number = 0;
	#intervals: number[] = [];
	#draws: number = 0;
	#drawn: number = 0;
	#lagged: number | null = null;
	#slow: boolean = false;

	constructor(visualizer: Visualizer) {
		super();
		this.#visualizer = visualizer;
		visualizer.addEventListener("update", event => this.#onUpdate());
		document.addEventListener("visibilitychange", event => this.#reset());
	}

	addEventListener<K extends keyof SmoothnessEventMap>(type: K, listener: (this: Smoothness, event: SmoothnessEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof SmoothnessEventMap>(type: K, listener: (this: Smoothness, event: SmoothnessEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		return super.removeEventListener(type, listener, options);
	}

	get slow(): boolean { return this.#slow; }

	static #median(intervals: readonly number[]): number {
		return intervals.toSorted((interval, interval2) => interval - interval2)[trunc(intervals.length / 2)];
	}

	#onUpdate(): void {
		const { rate, interval, fresh } = this.#visualizer;
		if (this.#started === null) return this.#start(rate);
		const clock = this.#clock += interval;
		if (rate !== this.#rate) this.#open(clock, rate);
		this.#intervals.push(interval);
		const gap = clock - this.#drawn;
		if (fresh) {
			this.#draws++;
			this.#drawn = clock;
		}
		if (gap > Smoothness.#freeze) this.#lag(clock);
		if (clock - this.#opened >= Smoothness.#length) this.#close(clock);
	}

	#start(rate: number): void {
		const clock = this.#clock;
		this.#started = clock;
		this.#drawn = clock;
		this.#open(clock, rate);
	}

	#open(clock: number, rate: number): void {
		this.#opened = clock;
		this.#rate = rate;
		this.#intervals = [];
		this.#draws = 0;
	}

	#close(clock: number): void {
		const rate = this.#rate;
		const fps = round(this.#draws * 1000 / (clock - this.#opened));
		const screens = this.#screens;
		screens.push(max(fps, 1000 / Smoothness.#median(this.#intervals)));
		if (screens.length > Smoothness.#memory) screens.shift();
		const frames = new FrameRate(fps, round(min(rate, max(...screens))));
		this.dispatchEvent(new CustomEvent("measure", { detail: frames }));
		if (frames.falls(Smoothness.#share)) this.#lag(clock);
		const lagged = this.#lagged;
		if (lagged === null || clock - lagged >= Smoothness.#hold) this.#mark(false);
		this.#open(clock, rate);
	}

	#lag(clock: number): void {
		const started = this.#started;
		if (started === null || clock - started < Smoothness.#warmup) return;
		this.#lagged = clock;
		this.#mark(true);
	}

	#reset(): void {
		this.#started = null;
	}

	#mark(value: boolean): void {
		if (this.#slow === value) return;
		this.#slow = value;
		this.dispatchEvent(new Event("change"));
	}
}
//#endregion
