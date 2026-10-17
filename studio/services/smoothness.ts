"use strict";

import "adaptive-extender/web";
import { type Visualizer } from "./visualizer.js";
import { RateWindow } from "./rate-window.js";

const { max } = Math;

//#region Frame rate
export class FrameRate {
	#fps: number;
	#normal: number;

	constructor(fps: number, normal: number) {
		this.#fps = fps;
		this.#normal = normal;
	}

	get fps(): number { return this.#fps; }
	get normal(): number { return this.#normal; }

	get summary(): string {
		return `${this.#fps} of normal ${this.#normal}\nframes/s`;
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
	static #patience: number = 1000;
	static #warmup: number = 3000;

	#visualizer: Visualizer;
	#window: RateWindow = new RateWindow(Smoothness.#length);
	#previous: number | null = null;
	#gap: number = 0;
	#started: number | null = null;
	#rate: number | null = null;
	#normal: number = 0;
	#since: number | null = null;
	#slow: boolean = false;

	constructor(visualizer: Visualizer) {
		super();
		this.#visualizer = visualizer;
		visualizer.addEventListener("update", event => this.#onUpdate(performance.now()));
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

	#onUpdate(now: number): void {
		const previous = this.#previous;
		this.#previous = now;
		if (previous !== null) this.#gap = max(this.#gap, now - previous);
		const fps = this.#window.count(now);
		if (fps === null) return;
		const gap = this.#gap;
		this.#gap = 0;
		this.#measure(new FrameRate(fps, this.#raise(fps)), gap, now);
	}

	#raise(fps: number): number {
		const { rate } = this.#visualizer;
		if (rate !== this.#rate) {
			this.#rate = rate;
			this.#normal = 0;
		}
		return this.#normal = max(this.#normal, fps);
	}

	#measure(frames: FrameRate, gap: number, now: number): void {
		this.dispatchEvent(new CustomEvent("measure", { detail: frames }));
		const started = this.#started;
		if (started === null) {
			this.#started = now;
			return;
		}
		if (now - started < Smoothness.#warmup) return;
		if (!frames.falls(Smoothness.#share) && gap <= Smoothness.#freeze) {
			this.#since = null;
			return this.#mark(false);
		}
		const since = this.#since;
		if (since === null) {
			this.#since = now;
			return;
		}
		if (now - since < Smoothness.#patience) return;
		this.#mark(true);
	}

	#reset(): void {
		this.#previous = null;
		this.#window.reset();
		this.#gap = 0;
		this.#started = null;
		this.#normal = 0;
		this.#since = null;
	}

	#mark(value: boolean): void {
		if (this.#slow === value) return;
		this.#slow = value;
		this.dispatchEvent(new Event("change"));
	}
}
//#endregion
