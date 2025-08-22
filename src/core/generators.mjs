"use strict";

const { random, trunc } = Math;

//#region Random
/**
 * Random values generator.
 */
class Random {
	/** @type {Random} */
	static #global = new Random();
	/**
	 * The global instance.
	 * @readonly
	 * @returns {Random}
	 */
	static get global() {
		return Random.#global;
	}
	/**
	 * Generates a random boolean value.
	 * @param {number} factor Probability for `true` (0 to 1, default is 0.5).
	 * @returns {boolean} Random boolean value.
	 * @throws {TypeError} If factor is not finite.
	 * @throws {RangeError} If factor is out of range.
	 */
	boolean(factor = 0.5) {
		if (!Number.isFinite(factor)) throw new TypeError(`The factor ${factor} must be a finite number`);
		if (0 > factor || factor > 1) throw new RangeError(`The factor ${factor} is out of range [0 - 1]`);
		return random() < factor;
	}
	/**
	 * Returns a random number in range [min - max).
	 * @param {number} min The minimum value.
	 * @param {number} max The maximum value.
	 * @returns {number} A random number.
	 */
	number(min, max) {
		return random() * (max - min) + min;
	}
	/**
	 * Returns a random integer in range [min - max).
	 * @param {number} min The minimum value.
	 * @param {number} max The maximum value.
	 * @returns {number} A random integer.
	 */
	integer(min, max) {
		return trunc(this.number(min, max));
	}
	/**
	 * Returns a random element from an array.
	 * @template T
	 * @param {Readonly<T[]>} array The array of elements.
	 * @returns {T} A random element.
	 * @throws {Error} If the array is empty.
	 */
	item(array) {
		if (1 > array.length) throw new Error(`Array must have at least 1 item`);
		return array[this.integer(0, array.length)];
	}
	/**
	 * Generates a range of random numbers from min to max (exclusive).
	 * @param {number} min The minimum value.
	 * @param {number} max The maximum value.
	 * @returns {number[]} An array of random numbers.
	 */
	range(min, max) {
		const array = Array.range(min, max);
		this.shuffle(array);
		return array;
	};
	/**
	 * Returns a random subarray of elements from an array.
	 * @template T
	 * @param {Readonly<T[]>} array The array of elements.
	 * @param {number} count The number of elements to select.
	 * @returns {T[]} A random subarray of elements.
	 * @throws {TypeError} If count is not a finite integer.
	 * @throws {RangeError} If count is less than 0 or greater than array length.
	 */
	subarray(array, count = 1) {
		if (!Number.isInteger(count)) throw new TypeError(`The count ${count} must be a finite integer number`);
		if (0 > count || count > array.length) throw new RangeError(`The count ${count} is out of range [0 - ${array.length}]`);
		const clone = Array.from(array);
		const subarray = [];
		for (let index = 0; index < count; index++) {
			subarray.push(...clone.splice(this.integer(0, clone.length), 1));
		}
		return subarray;
	}
	/**
	 * Shuffles the elements of an array in place using the Fisher-Yates algorithm.
	 * @template T
	 * @param {T[]} array The array to shuffle.
	 * @returns {void}
	 */
	shuffle(array) {
		for (let index = 0; index < array.length - 1; index++) {
			const pair = this.integer(index, array.length);
			if (pair === index) continue;
			array.swap(index, pair);
		}
	}
	/**
	 * Selects a random element from a list according to their weights.
	 * @template T
	 * @param {Readonly<Map<T, number>>} cases The map with elements and their weights.
	 * @returns {T} A random element.
	 * @throws {RangeError} If the map is empty.
	 */
	case(cases) {
		if (1 > cases.size) throw new RangeError(`The cases must have at least 1 item`);
		const summary = Array.from(cases).reduce((previous, [, weight]) => previous + weight, 0);
		const random = this.number(0, summary);
		let begin = 0;
		for (const [item, weight] of cases) {
			const end = begin + weight;
			if (begin <= random && random < end) {
				return item;
			}
			begin = end;
		}
		throw new Error(`Unable to select element with value ${random}`);
	};
}
//#endregion

export { Random };
