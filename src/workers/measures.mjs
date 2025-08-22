"use strict";

import { FastEngine } from "./generators.js";

//#region Timer
/**
 * @typedef {object} TimerEventMap
 * @property {Event} trigger
 */

/**
 * A Timer class that triggers events based on a countdown mechanism.
 * It supports both single and repeated countdowns and allows subscribing to updates through events.
 */
class Timer extends EventTarget {
	/**
	 * @param {boolean} multiple Determines whether the timer can trigger multiple times.
	 */
	constructor(multiple = false) {
		super();

		this.#multiple = multiple;
		setInterval(this.#callback.bind(this));
	}
	/**
	 * @template {keyof TimerEventMap} K
	 * @overload
	 * @param {K} type 
	 * @param {(this: Timer, ev: TimerEventMap[K]) => any} listener 
	 * @param {boolean | AddEventListenerOptions} [options] 
	 * @returns {void}
	 */
	/**
	 * @overload
	 * @param {string} type 
	 * @param {EventListenerOrEventListenerObject} listener 
	 * @param {boolean | AddEventListenerOptions} [options] 
	 * @returns {void}
	 */
	/**
	 * @param {string} type 
	 * @param {EventListenerOrEventListenerObject} listener 
	 * @param {boolean | AddEventListenerOptions} options 
	 * @returns {void}
	 */
	addEventListener(type, listener, options = false) {
		return super.addEventListener(type, listener, options);
	}
	/**
	 * @template {keyof TimerEventMap} K
	 * @overload
	 * @param {K} type 
	 * @param {(this: Timer, ev: TimerEventMap[K]) => any} listener 
	 * @param {boolean | EventListenerOptions} [options] 
	 * @returns {void}
	 */
	/**
	 * @overload
	 * @param {string} type 
	 * @param {EventListenerOrEventListenerObject} listener 
	 * @param {boolean | EventListenerOptions} [options] 
	 * @returns {void}
	 */
	/**
	 * @param {string} type 
	 * @param {EventListenerOrEventListenerObject} listener 
	 * @param {boolean | EventListenerOptions} options 
	 * @returns {void}
	 */
	removeEventListener(type, listener, options = false) {
		return super.removeEventListener(type, listener, options);
	}
	/** @type {boolean} */
	#multiple;
	/** @type {number} */
	#remaining = 0;
	/**
	 * Gets the remaining time in milliseconds.
	 * @readonly
	 * @returns {number}
	 */
	get remaining() {
		return this.#remaining;
	}
	/**
	 * Sets the timer to trigger after a specific timeout.
	 * @param {number} milliseconds The timeout duration in milliseconds.
	 * @returns {void}
	 */
	setTimeout(milliseconds = 0) {
		this.#remaining = milliseconds.clamp(0, Infinity);
	}
	/** @type {number} */
	#previous = performance.now();
	/**
	 * @returns {void}
	 */
	#callback() {
		if (!this.#multiple && this.#remaining === 0) return;
		const current = performance.now();
		const difference = current - this.#previous;
		this.#remaining -= difference;
		if (this.#remaining <= 0) {
			this.#remaining = 0;
			this.dispatchEvent(new Event(`trigger`));
		}
		this.#previous = current;
	}
}
//#endregion
//#region Stopwatch
/**
 * A class representing a stopwatch to measure time durations.
 */
class Stopwatch {
	/**
	 * @param {boolean} launch Whether to start the stopwatch immediately.
	 */
	constructor(launch = false) {
		this.#launched = launch;

		const engine = new FastEngine(true);
		engine.addEventListener(`trigger`, event => this.#callback(performance.now()));
	}
	/** @type {DOMHighResTimeStamp} */
	#elapsed = 0;
	/**
	 * Gets the elapsed time as milliseconds.
	 * @readonly
	 * @returns {DOMHighResTimeStamp}
	 */
	get elapsed() {
		return this.#elapsed;
	}
	/**
	 * Resets the elapsed time to zero.
	 * @returns {void}
	 */
	reset() {
		this.#elapsed = 0;
	}
	/** @type {boolean} */
	#launched;
	/**
	 * Gets the launched state of the stopwatch.
	 * @returns {boolean}
	 */
	get launched() {
		return this.#launched;
	}
	/**
	 * Sets the launched state of the stopwatch.
	 * @param {boolean} value
	 * @returns {void}
	 */
	set launched(value) {
		this.#launched = value;
	}
	/** @type {number} */
	#previous = performance.now();
	/**
	 * @param {DOMHighResTimeStamp} current 
	 * @returns {void}
	 */
	#callback(current) {
		if (this.#launched) {
			this.#elapsed += current - this.#previous;
		}
		this.#previous = current;
	}
}
//#endregion

export { Timer, Stopwatch };
