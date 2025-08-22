"use strict";

import { ImplementationError } from "../core/extensions.js";

const { hypot, abs, trunc } = Math;

//#region Vector
/**
 * Abstract base class representing a vector.
 * @abstract
 */
class Vector {
	//#region Operations
	/**
	 * Checks if every component of the vector is NaN.
	 * @param {Vector} vector The vector to check.
	 * @returns {boolean} True if every component of the vector is NaN, otherwise false.
	 */
	static isNaN(vector) {
		for (const metric of vector) {
			if (!Number.isNaN(metric)) return false;
		}
		return true;
	}
	/**
	 * Checks if all components of the vector are finite numbers.
	 * @param {Vector} vector The vector to check.
	 * @returns {boolean} True if all components of the vector are finite, otherwise false.
	 */
	static isFinite(vector) {
		for (const metric of vector) {
			if (!Number.isFinite(metric)) return false;
		}
		return true;
	}
	/**
	 * Checks if all components of the vector are integers.
	 * @param {Vector} vector The vector to check.
	 * @returns {boolean} True if all components of the vector are integers, otherwise false.
	 */
	static isInteger(vector) {
		for (const metric of vector) {
			if (!Number.isInteger(metric)) return false;
		}
		return true;
	}
	/**
	 * Checks if all components of the vector are safe integers.
	 * @param {Vector} vector The vector to check.
	 * @returns {boolean} True if all components of the vector are safe integers, otherwise false.
	 */
	static isSafeInteger(vector) {
		for (const metric of vector) {
			if (!Number.isSafeInteger(metric)) return false;
		}
		return true;
	}
	/**
	 * @param {any[]} metrics 
	 * @returns {string}
	 */
	static #join(metrics) {
		return `(${metrics.join(`, `)})`;
	}
	constructor() {
		if (new.target === Vector) throw new TypeError(`Unable to create an instance of an abstract class`);
	}
	//#endregion
	//#region Modifiers
	/**
	 * Returns an iterator object that yields each component of the vector.
	 * @abstract
	 * @returns {Iterator<number>} An iterator object.
	 */
	*[Symbol.iterator]() {
		throw new ImplementationError();
	}
	/**
	 * Returns a string representation of the vector with a fixed number of digits after the decimal vector.
	 * @param {number} [digits] The number of digits to appear after the decimal vector.
	 * @returns {string} A string representation of the vector.
	 */
	toFixed(digits) {
		return Vector.#join(Array.from(this).map(metric => metric.toFixed(digits)));
	}
	/**
	 * Returns a string representation of the vector in exponential notation.
	 * @param {number} [digits] The number of digits to appear after the decimal vector.
	 * @returns {string} A string representation of the vector in exponential notation.
	 */
	toExponential(digits) {
		return Vector.#join(Array.from(this).map(metric => metric.toExponential(digits)));
	}
	/**
	 * Returns a string representation of the vector with a specified precision.
	 * @param {number} [precision] The number of significant digits.
	 * @returns {string} A string representation of the vector with the specified precision.
	 */
	toPrecision(precision) {
		return Vector.#join(Array.from(this).map(metric => metric.toPrecision(precision)));
	}
	/**
	 * Returns a string representation of the vector in the specified radix (base).
	 * @param {number} [radix] An integer between 2 and 36 specifying the base to use for representing numeric values.
	 * @returns {string} A string representation of the vector in the specified radix.
	 */
	toString(radix) {
		return Vector.#join(Array.from(this).map(metric => metric.toString(radix)));
	}
	/**
	 * Returns a string representation of the vector formatted according to the specified locale and formatting options.
	 * @param {Intl.LocalesArgument} [locales] A string with a BCP 47 language tag, or an array of such strings.
	 * @param {Intl.NumberFormatOptions} [options] An object with some or all of the following properties.
	 * @returns {string} A string representation of the vector formatted according to the specified locale and formatting options.
	 */
	toLocaleString(locales, options) {
		return Vector.#join(Array.from(this).map(metric => metric.toLocaleString(locales, options)));
	}
	//#endregion
}
//#endregion
//#region Vector 1D
/**
 * Represents a vector in one-dimensional space.
 */
class Vector1D extends Vector {
	//#region Operations
	/**
	 * Calculates the distance between two vectors.
	 * @param {Readonly<Vector1D>} first The first vector.
	 * @param {Readonly<Vector1D>} second The second vector.
	 * @returns {number} The distance between the two vectors.
	 */
	static getDistanceBetween(first, second) {
		return hypot(first.x - second.x);
	}
	/**
	 * Adds two vectors.
	 * @param {Readonly<Vector1D>} first The first vector.
	 * @param {Readonly<Vector1D>} second The second vector.
	 * @returns {Vector1D} The result of the addition.
	 */
	static ["+"](first, second) {
		return new Vector1D(first.x + second.x);
	}
	/**
	 * Subtracts the second vector from the first.
	 * @param {Readonly<Vector1D>} first The first vector.
	 * @param {Readonly<Vector1D>} second The second vector.
	 * @returns {Vector1D} The result of the subtraction.
	 */
	static ["-"](first, second) {
		return new Vector1D(first.x - second.x);
	}
	/**
	 * Multiplies two vectors.
	 * @param {Readonly<Vector1D>} first The first vector.
	 * @param {Readonly<Vector1D>} second The second vector.
	 * @returns {Vector1D} The result of the multiplication.
	 */
	static ["*"](first, second) {
		return new Vector1D(first.x * second.x);
	}
	/**
	 * Divides the first vector by the second.
	 * @param {Readonly<Vector1D>} first The first vector.
	 * @param {Readonly<Vector1D>} second The second vector.
	 * @returns {Vector1D} The result of the division.
	 */
	static ["/"](first, second) {
		return new Vector1D(first.x / second.x);
	}
	//#endregion
	//#region Presets
	/**
	 * Returns the new NaN vector - (NaN).
	 * @readonly
	 * @returns {Vector1D} The NaN vector.
	 */
	static get newNaN() {
		return Vector1D.fill(NaN);
	}
	/**
	 * Returns the new zero vector - (0).
	 * @readonly
	 * @returns {Vector1D} The zero vector.
	 */
	static get newZero() {
		return Vector1D.fill(0);
	}
	/**
	 * Returns the new single vector - (1).
	 * @readonly
	 * @returns {Vector1D} The single vector.
	 */
	static get newSingle() {
		return Vector1D.fill(1);
	}
	/**
	 * Returns the new double vector - (2).
	 * @readonly
	 * @returns {Vector1D} The double vector.
	 */
	static get newDouble() {
		return Vector1D.fill(2);
	}
	//#endregion
	//#region Constants
	/** @type {Readonly<Vector1D>} */
	static #CONSTANT_NAN = Object.freeze(Vector1D.newNaN);
	/**
	 * Returns the constant NaN vector - (NaN).
	 * @readonly
	 * @returns {Readonly<Vector1D>} The constant NaN vector.
	 */
	static get CONSTANT_NAN() {
		return this.#CONSTANT_NAN;
	}
	/** @type {Readonly<Vector1D>} */
	static #CONSTANT_ZERO = Object.freeze(Vector1D.newZero);
	/**
	 * Returns the constant zero vector - (0).
	 * @readonly
	 * @returns {Readonly<Vector1D>} The constant zero vector.
	 */
	static get CONSTANT_ZERO() {
		return this.#CONSTANT_ZERO;
	}
	/** @type {Readonly<Vector1D>} */
	static #CONSTANT_SINGLE = Object.freeze(Vector1D.newSingle);
	/**
	 * Returns the constant single vector - (1).
	 * @readonly
	 * @returns {Readonly<Vector1D>} The constant single vector.
	 */
	static get CONSTANT_SINGLE() {
		return this.#CONSTANT_SINGLE;
	}
	/** @type {Readonly<Vector1D>} */
	static #CONSTANT_DOUBLE = Object.freeze(Vector1D.newDouble);
	/**
	 * Returns the constant double vector - (2).
	 * @readonly
	 * @returns {Readonly<Vector1D>} The constant double vector.
	 */
	static get CONSTANT_DOUBLE() {
		return this.#CONSTANT_DOUBLE;
	}
	//#endregion
	//#region Builders
	/** @type {RegExp} */
	static #regexVectorParser = /^\(\s*(\S+)\s*\)$/;
	/**
	 * Parses a string representation of a vector.
	 * @param {string} string The string representation of the vector.
	 * @returns {Vector1D} The parsed vector.
	 * @throws {SyntaxError} If the string is not a valid representation of a vector.
	 */
	static parse(string) {
		const match = Vector1D.#regexVectorParser.exec(string.trim());
		if (match === null) throw new SyntaxError(`Invalid syntax '${string}' for 1D vector`);
		const [, x] = match.map(Number);
		return new Vector1D(x);
	}
	/**
	 * Static method to create a vector with a repeated value.
	 * @param {number} value The value to repeat.
	 * @returns {Vector1D} A new vector with the specified value.
	 */
	static fill(value) {
		return new Vector1D(value);
	}
	/**
	 * @overload
	 * @param {number} x The x-coordinate of the vector.
	 * 
	 * @overload
	 * @param {Readonly<Vector1D>} source A source vector to copy.
	 */
	/**
	 * @param {[number] | [Readonly<Vector1D>]} args 
	 */
	constructor(...args) {
		const [arg1] = args;
		if (arg1 instanceof Vector1D) {
			super();
			this.#x = arg1.x;
			return;
		}
		super();
		if (typeof (arg1) === `number`) {
			this.#x = arg1;
			return;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	//#endregion
	//#region Properties
	/** @type {number} */
	#x;
	/**
	 * Gets the x-coordinate of the vector.
	 * @returns {number} The x-coordinate.
	 */
	get x() {
		return this.#x;
	}
	/**
	 * Sets the x-coordinate of the vector.
	 * @param {number} value The new value for the x-coordinate.
	 */
	set x(value) {
		this.#x = value;
	}
	//#endregion
	//#region Modifiers
	/**
	 * Returns an iterator that yields the coordinates of the vector.
	 * @returns {Iterator<number>} An iterator object that yields the coordinates.
	 */
	*[Symbol.iterator]() {
		yield this.x;
		return;
	}
	/**
	 * Maps a callback function to the vector's coordinates.
	 * @param {(metric: number) => number} callback The callback function.
	 * @returns {Vector1D} A new vector with the mapped coordinates.
	 */
	map(callback) {
		return new Vector1D(callback(this.x));
	}
	/**
	 * Adds a scalar to the current vector.
	 * @overload
	 * @param {number} scalar A scalar value to add.
	 * @returns {this} The updated vector.
	 * 
	 * Adds another vector to the current vector.
	 * @overload
	 * @param {Readonly<Vector1D>} other Another vector to add.
	 * @returns {this} The updated vector.
	 */
	/**
	 * @param {Readonly<Vector1D> | number} arg1 
	 * @returns {this}
	 */
	["+="](arg1) {
		if (arg1 instanceof Vector1D) {
			this.x += arg1.x;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.x += arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	/**
	 * Subtracts a scalar from the current vector.
	 * @overload
	 * @param {number} scalar A scalar value to subtract.
	 * @returns {this} The updated vector.
	 * 
	 * Subtracts another vector from the current vector.
	 * @overload
	 * @param {Readonly<Vector1D>} other Another vector to subtract.
	 * @returns {this} The updated vector.
	 */
	/**
	 * @param {Readonly<Vector1D> | number} arg1 
	 * @returns {this}
	 */
	["-="](arg1) {
		if (arg1 instanceof Vector1D) {
			this.x -= arg1.x;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.x -= arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	/**
	 * Multiplies the current vector by a scalar.
	 * @overload
	 * @param {number} scalar A scalar value to multiply by.
	 * @returns {this} The updated vector.
	 * 
	 * Multiplies the current vector by another vector.
	 * @overload
	 * @param {Readonly<Vector1D>} other Another vector to multiply by.
	 * @returns {this} The updated vector.
	 */
	/**
	 * @param {Readonly<Vector1D> | number} arg1 
	 * @returns {this}
	 */
	["*="](arg1) {
		if (arg1 instanceof Vector1D) {
			this.x *= arg1.x;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.x *= arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	/**
	 * Divides the current vector by a scalar.
	 * @overload
	 * @param {number} scalar A scalar value to divide by.
	 * @returns {this} The updated vector.
	 * 
	 * Divides the current vector by another vector.
	 * @overload
	 * @param {Readonly<Vector1D>} other Another vector to divide by.
	 * @returns {this} The updated vector.
	 */
	/**
	 * @param {Readonly<Vector1D> | number} arg1 
	 * @returns {this}
	 */
	["/="](arg1) {
		if (arg1 instanceof Vector1D) {
			this.x /= arg1.x;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.x /= arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	//#endregion
}
//#endregion
//#region Vector 2D
/**
 * Represents a vector in two-dimensional space.
 */
class Vector2D extends Vector1D {
	//#region Operations
	/**
	 * Calculates the distance between two vectors.
	 * @param {Readonly<Vector2D>} first The first vector.
	 * @param {Readonly<Vector2D>} second The second vector.
	 * @returns {number} The distance between the two vectors.
	 */
	static getDistanceBetween(first, second) {
		return hypot(first.x - second.x, first.y - second.y);
	}
	/**
	 * Adds two vectors.
	 * @param {Readonly<Vector2D>} first The first vector.
	 * @param {Readonly<Vector2D>} second The second vector.
	 * @returns {Vector2D} The result of the addition.
	 */
	static ["+"](first, second) {
		return new Vector2D(first.x + second.x, first.y + second.y);
	}
	/**
	 * Subtracts the second vector from the first.
	 * @param {Readonly<Vector2D>} first The first vector.
	 * @param {Readonly<Vector2D>} second The second vector.
	 * @returns {Vector2D} The result of the subtraction.
	 */
	static ["-"](first, second) {
		return new Vector2D(first.x - second.x, first.y - second.y);
	}
	/**
	 * Multiplies two vectors.
	 * @param {Readonly<Vector2D>} first The first vector.
	 * @param {Readonly<Vector2D>} second The second vector.
	 * @returns {Vector2D} The result of the multiplication.
	 */
	static ["*"](first, second) {
		return new Vector2D(first.x * second.x, first.y * second.y);
	}
	/**
	 * Divides the first vector by the second.
	 * @param {Readonly<Vector2D>} first The first vector.
	 * @param {Readonly<Vector2D>} second The second vector.
	 * @returns {Vector2D} The result of the division.
	 */
	static ["/"](first, second) {
		return new Vector2D(first.x / second.x, first.y / second.y);
	}
	//#endregion
	//#region Presets
	/**
	 * Returns the new NaN vector - (NaN, NaN).
	 * @readonly
	 * @returns {Vector2D} The NaN vector.
	 */
	static get newNaN() {
		return Vector2D.fill(NaN);
	}
	/**
	 * Returns the new zero vector - (0, 0).
	 * @readonly
	 * @returns {Vector2D} The zero vector.
	 */
	static get newZero() {
		return Vector2D.fill(0);
	}
	/**
	 * Returns the new single vector - (1, 1).
	 * @readonly
	 * @returns {Vector2D} The single vector.
	 */
	static get newSingle() {
		return Vector2D.fill(1);
	}
	/**
	 * Returns the new double vector - (2, 2).
	 * @readonly
	 * @returns {Vector2D} The double vector.
	 */
	static get newDouble() {
		return Vector2D.fill(2);
	}
	//#endregion
	//#region Constants
	/** @type {Readonly<Vector2D>} */
	static #CONSTANT_NAN = Object.freeze(Vector2D.newNaN);
	/**
	 * Returns the constant NaN vector - (NaN, NaN).
	 * @readonly
	 * @returns {Readonly<Vector2D>} The constant NaN vector.
	 */
	static get CONSTANT_NAN() {
		return this.#CONSTANT_NAN;
	}
	/** @type {Readonly<Vector2D>} */
	static #CONSTANT_ZERO = Object.freeze(Vector2D.newZero);
	/**
	 * Returns the constant zero vector - (0, 0).
	 * @readonly
	 * @returns {Readonly<Vector2D>} The constant zero vector.
	 */
	static get CONSTANT_ZERO() {
		return this.#CONSTANT_ZERO;
	}
	/** @type {Readonly<Vector2D>} */
	static #CONSTANT_SINGLE = Object.freeze(Vector2D.newSingle);
	/**
	 * Returns the constant single vector - (1, 1).
	 * @readonly
	 * @returns {Readonly<Vector2D>} The constant single vector.
	 */
	static get CONSTANT_SINGLE() {
		return this.#CONSTANT_SINGLE;
	}
	/** @type {Readonly<Vector2D>} */
	static #CONSTANT_DOUBLE = Object.freeze(Vector2D.newDouble);
	/**
	 * Returns the constant double vector - (2, 2).
	 * @readonly
	 * @returns {Readonly<Vector2D>} The constant double vector.
	 */
	static get CONSTANT_DOUBLE() {
		return this.#CONSTANT_DOUBLE;
	}
	//#endregion
	//#region Builders
	/** @type {RegExp} */
	static #regexVectorParser = /^\(\s*(\S+)\s*,\s*(\S+)\s*\)$/;
	/**
	 * Parses a string representation of a vector.
	 * @param {string} string The string representation of the vector.
	 * @returns {Vector2D} The parsed vector.
	 * @throws {SyntaxError} If the string is not a valid representation of a vector.
	 */
	static parse(string) {
		const match = Vector2D.#regexVectorParser.exec(string.trim());
		if (match === null) throw new SyntaxError(`Invalid syntax '${string}' for 2D vector`);
		const [, x, y] = match.map(Number);
		return new Vector2D(x, y);
	}
	/**
	 * Static method to create a vector with a repeated value.
	 * @param {number} value The value to repeat.
	 * @returns {Vector2D} A new vector with the specified value.
	 */
	static fill(value) {
		return new Vector2D(value, value);
	}
	/**
	 * @overload
	 * @param {number} x The x-coordinate of the vector.
	 * @param {number} y The y-coordinate of the vector.
	 * 
	 * @overload
	 * @param {Readonly<Vector2D>} source A source vector to copy.
	 */
	/**
	 * @param {[number, number] | [Readonly<Vector2D>]} args 
	 */
	constructor(...args) {
		const [arg1, arg2] = args;
		if (arg1 instanceof Vector2D) {
			super(arg1.x);
			this.#y = arg1.y;
			return;
		}
		super(/** @type {number} */(arg1));
		if (typeof (arg2) === `number`) {
			this.#y = arg2;
			return;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	//#endregion
	//#region Properties
	/** @type {number} */
	#y;
	/**
	 * Gets the y-coordinate of the vector.
	 * @returns {number} The y-coordinate.
	 */
	get y() {
		return this.#y;
	}
	/**
	 * Sets the y-coordinate of the vector.
	 * @param {number} value The new value for the y-coordinate.
	 */
	set y(value) {
		this.#y = value;
	}
	//#endregion
	//#region Modifiers
	/**
	 * Returns an iterator that yields the coordinates of the vector.
	 * @returns {Iterator<number>} An iterator object that yields the coordinates.
	 */
	*[Symbol.iterator]() {
		yield this.x;
		yield this.y;
		return;
	}
	/**
	 * Maps a callback function to the vector's coordinates.
	 * @param {(metric: number) => number} callback The callback function.
	 * @returns {Vector2D} A new vector with the mapped coordinates.
	 */
	map(callback) {
		return new Vector2D(callback(this.x), callback(this.y));
	}
	/**
	 * Adds a scalar to the current vector.
	 * @overload
	 * @param {number} scalar A scalar value to add.
	 * @returns {this} The updated vector.
	 * 
	 * Adds another vector to the current vector.
	 * @overload
	 * @param {Readonly<Vector1D>} other Another vector to add.
	 * @returns {this} The updated vector.
	 * 
	 * Adds another vector to the current vector.
	 * @overload
	 * @param {Readonly<Vector2D>} other Another vector to add.
	 * @returns {this} The updated vector.
	 */
	/**
	 * @param {[number | Readonly<Vector1D> | Readonly<Vector2D>]} args 
	 * @returns {this}
	 */
	["+="](...args) {
		const [arg1] = args;
		if (arg1 instanceof Vector2D) {
			this.x += arg1.x;
			this.y += arg1.y;
			return this;
		}
		if (arg1 instanceof Vector1D) {
			this.x += arg1.x;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.x += arg1;
			this.y += arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	/**
	 * Subtracts a scalar from the current vector.
	 * @overload
	 * @param {number} scalar A scalar value to subtract.
	 * @returns {this} The updated vector.
	 * 
	 * Subtracts another vector from the current vector.
	 * @overload
	 * @param {Readonly<Vector1D>} other Another vector to subtract.
	 * @returns {this} The updated vector.
	 * 
	 * Subtracts another vector from the current vector.
	 * @overload
	 * @param {Readonly<Vector2D>} other Another vector to subtract.
	 * @returns {this} The updated vector.
	 */
	/**
	 * @param {[number | Readonly<Vector1D> | Readonly<Vector2D>]} args 
	 * @returns {this}
	 */
	["-="](...args) {
		const [arg1] = args;
		if (arg1 instanceof Vector2D) {
			this.x -= arg1.x;
			this.y -= arg1.y;
			return this;
		}
		if (arg1 instanceof Vector1D) {
			this.x -= arg1.x;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.x -= arg1;
			this.y -= arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	/**
	 * Multiplies the current vector by a scalar.
	 * @overload
	 * @param {number} scalar A scalar value to multiply by.
	 * @returns {this} The updated vector.
	 * 
	 * Multiplies the current vector by another vector.
	 * @overload
	 * @param {Readonly<Vector1D>} other Another vector to multiply by.
	 * @returns {this} The updated vector.
	 * 
	 * Multiplies the current vector by another vector.
	 * @overload
	 * @param {Readonly<Vector2D>} other Another vector to multiply by.
	 * @returns {this} The updated vector.
	 */
	/**
	 * @param {[number | Readonly<Vector1D> | Readonly<Vector2D>]} args 
	 * @returns {this}
	 */
	["*="](...args) {
		const [arg1] = args;
		if (arg1 instanceof Vector2D) {
			this.x *= arg1.x;
			this.y *= arg1.y;
			return this;
		}
		if (arg1 instanceof Vector1D) {
			this.x *= arg1.x;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.x *= arg1;
			this.y *= arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	/**
	 * Divides the current vector by a scalar.
	 * @overload
	 * @param {number} scalar A scalar value to divide by.
	 * @returns {this} The updated vector.
	 * 
	 * Divides the current vector by another vector.
	 * @overload
	 * @param {Readonly<Vector1D>} other Another vector to divide by.
	 * @returns {this} The updated vector.
	 * 
	 * Divides the current vector by another vector.
	 * @overload
	 * @param {Readonly<Vector2D>} other Another vector to divide by.
	 * @returns {this} The updated vector.
	 */
	/**
	 * @param {[number | Readonly<Vector1D> | Readonly<Vector2D>]} args 
	 * @returns {this}
	 */
	["/="](...args) {
		const [arg1] = args;
		if (arg1 instanceof Vector2D) {
			this.x /= arg1.x;
			this.y /= arg1.y;
			return this;
		}
		if (arg1 instanceof Vector1D) {
			this.x /= arg1.x;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.x /= arg1;
			this.y /= arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	//#endregion
}
//#endregion
//#region Vector 3D
/**
 * Represents a vector in three-dimensional space.
 */
class Vector3D extends Vector2D {
	//#region Operations
	/**
	 * Calculates the distance between two vectors.
	 * @param {Readonly<Vector3D>} first The first vector.
	 * @param {Readonly<Vector3D>} second The second vector.
	 * @returns {number} The distance between the two vectors.
	 */
	static getDistanceBetween(first, second) {
		return hypot(first.x - second.x, first.y - second.y, first.z - second.z);
	}
	/**
	 * Adds two vectors.
	 * @param {Readonly<Vector3D>} first The first vector.
	 * @param {Readonly<Vector3D>} second The second vector.
	 * @returns {Vector3D} The result of the addition.
	 */
	static ["+"](first, second) {
		return new Vector3D(first.x + second.x, first.y + second.y, first.z + second.z);
	}
	/**
	 * Subtracts the second vector from the first.
	 * @param {Readonly<Vector3D>} first The first vector.
	 * @param {Readonly<Vector3D>} second The second vector.
	 * @returns {Vector3D} The result of the subtraction.
	 */
	static ["-"](first, second) {
		return new Vector3D(first.x - second.x, first.y - second.y, first.z - second.z);
	}
	/**
	 * Multiplies two vectors.
	 * @param {Readonly<Vector3D>} first The first vector.
	 * @param {Readonly<Vector3D>} second The second vector.
	 * @returns {Vector3D} The result of the multiplication.
	 */
	static ["*"](first, second) {
		return new Vector3D(first.x * second.x, first.y * second.y, first.z * second.z);
	}
	/**
	 * Divides the first vector by the second.
	 * @param {Readonly<Vector3D>} first The first vector.
	 * @param {Readonly<Vector3D>} second The second vector.
	 * @returns {Vector3D} The result of the division.
	 */
	static ["/"](first, second) {
		return new Vector3D(first.x / second.x, first.y / second.y, first.z / second.z);
	}
	//#endregion
	//#region Presets
	/**
	 * Returns the new NaN vector - (NaN, NaN, NaN).
	 * @readonly
	 * @returns {Vector3D} The NaN vector.
	 */
	static get newNaN() {
		return Vector3D.fill(NaN);
	}
	/**
	 * Returns the new zero vector - (0, 0, 0).
	 * @readonly
	 * @returns {Vector3D} The zero vector.
	 */
	static get newZero() {
		return Vector3D.fill(0);
	}
	/**
	 * Returns the new single vector - (1, 1, 1).
	 * @readonly
	 * @returns {Vector3D} The single vector.
	 */
	static get newSingle() {
		return Vector3D.fill(1);
	}
	/**
	 * Returns the new double vector - (2, 2, 2).
	 * @readonly
	 * @returns {Vector3D} The double vector.
	 */
	static get newDouble() {
		return Vector3D.fill(2);
	}
	//#endregion
	//#region Constants
	/** @type {Readonly<Vector3D>} */
	static #CONSTANT_NAN = Object.freeze(Vector3D.newNaN);
	/**
	 * Returns the constant NaN vector - (NaN, NaN, NaN).
	 * @readonly
	 * @returns {Readonly<Vector3D>} The constant NaN vector.
	 */
	static get CONSTANT_NAN() {
		return this.#CONSTANT_NAN;
	}
	/** @type {Readonly<Vector3D>} */
	static #CONSTANT_ZERO = Object.freeze(Vector3D.newZero);
	/**
	 * Returns the constant zero vector - (0, 0, 0).
	 * @readonly
	 * @returns {Readonly<Vector3D>} The constant zero vector.
	 */
	static get CONSTANT_ZERO() {
		return this.#CONSTANT_ZERO;
	}
	/** @type {Readonly<Vector3D>} */
	static #CONSTANT_SINGLE = Object.freeze(Vector3D.newSingle);
	/**
	 * Returns the constant single vector - (1, 1, 1).
	 * @readonly
	 * @returns {Readonly<Vector3D>} The constant single vector.
	 */
	static get CONSTANT_SINGLE() {
		return this.#CONSTANT_SINGLE;
	}
	/** @type {Readonly<Vector3D>} */
	static #CONSTANT_DOUBLE = Object.freeze(Vector3D.newDouble);
	/**
	 * Returns the constant double vector - (2, 2, 2).
	 * @readonly
	 * @returns {Readonly<Vector3D>} The constant double vector.
	 */
	static get CONSTANT_DOUBLE() {
		return this.#CONSTANT_DOUBLE;
	}
	//#endregion
	//#region Builders
	/** @type {RegExp} */
	static #regexVectorParser = /^\(\s*(\S+)\s*,\s*(\S+)\s*,\s*(\S+)\s*\)$/;
	/**
	 * Parses a string representation of a vector.
	 * @param {string} string The string representation of the vector.
	 * @returns {Vector3D} The parsed vector.
	 * @throws {SyntaxError} If the string is not a valid representation of a vector.
	 */
	static parse(string) {
		const match = Vector3D.#regexVectorParser.exec(string.trim());
		if (match === null) throw new SyntaxError(`Invalid syntax '${string}' for 3D vector`);
		const [, x, y, z] = match.map(Number);
		return new Vector3D(x, y, z);
	}
	/**
	 * Static method to create a vector with a repeated value.
	 * @param {number} value The value to repeat.
	 * @returns {Vector3D} A new vector with the specified value.
	 */
	static fill(value) {
		return new Vector3D(value, value, value);
	}
	/**
	 * @overload
	 * @param {number} x The x-coordinate of the vector.
	 * @param {number} y The y-coordinate of the vector.
	 * @param {number} z The z-coordinate of the vector.
	 * 
	 * @overload
	 * @param {Readonly<Vector3D>} source A source vector to copy.
	 */
	/**
	 * @param {[number, number, number] | [Readonly<Vector3D>]} args 
	 */
	constructor(...args) {
		const [arg1, arg2, arg3] = args;
		if (arg1 instanceof Vector3D) {
			super(arg1.x, arg1.y);
			this.#z = arg1.z;
			return;
		}
		super(/** @type {number} */(arg1), /** @type {number} */(arg2));
		if (typeof (arg3) === `number`) {
			this.#z = arg3;
			return;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	//#endregion
	//#region Properties
	/** @type {number} */
	#z;
	/**
	 * Gets the z-coordinate of the vector.
	 * @returns {number} The z-coordinate.
	 */
	get z() {
		return this.#z;
	}
	/**
	 * Sets the z-coordinate of the vector.
	 * @param {number} value The new value for the z-coordinate.
	 */
	set z(value) {
		this.#z = value;
	}
	//#endregion
	//#region Modifiers
	/**
	 * Returns an iterator that yields the coordinates of the vector.
	 * @returns {Iterator<number>} An iterator object that yields the coordinates.
	 */
	*[Symbol.iterator]() {
		yield this.x;
		yield this.y;
		yield this.z;
		return;
	}
	/**
	 * Maps a callback function to the vector's coordinates.
	 * @param {(metric: number) => number} callback The callback function.
	 * @returns {Vector3D} A new vector with the mapped coordinates.
	 */
	map(callback) {
		return new Vector3D(callback(this.x), callback(this.y), callback(this.z));
	}
	/**
	 * Adds a scalar to the current vector.
	 * @overload
	 * @param {number} scalar A scalar value to add.
	 * @returns {this} The updated vector.
	 * 
	 * Adds another vector to the current vector.
	 * @overload
	 * @param {Readonly<Vector1D>} other Another vector to add.
	 * @returns {this} The updated vector.
	 * 
	 * Adds another vector to the current vector.
	 * @overload
	 * @param {Readonly<Vector2D>} other Another vector to add.
	 * @returns {this} The updated vector.
	 * 
	 * Adds another vector to the current vector.
	 * @overload
	 * @param {Readonly<Vector3D>} other Another vector to add.
	 * @returns {this} The updated vector.
	 */
	/**
	 * @param {[number | Readonly<Vector1D> | Readonly<Vector2D> | Readonly<Vector3D>]} args 
	 * @returns {this}
	 */
	["+="](...args) {
		const [arg1] = args;
		if (arg1 instanceof Vector3D) {
			this.x += arg1.x;
			this.y += arg1.y;
			this.z += arg1.z;
			return this;
		}
		if (arg1 instanceof Vector2D) {
			this.x += arg1.x;
			this.y += arg1.y;
			return this;
		}
		if (arg1 instanceof Vector1D) {
			this.x += arg1.x;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.x += arg1;
			this.y += arg1;
			this.z += arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	/**
	 * Subtracts a scalar from the current vector.
	 * @overload
	 * @param {number} scalar A scalar value to subtract.
	 * @returns {this} The updated vector.
	 * 
	 * Subtracts another vector from the current vector.
	 * @overload
	 * @param {Readonly<Vector1D>} other Another vector to subtract.
	 * @returns {this} The updated vector.
	 * 
	 * Subtracts another vector from the current vector.
	 * @overload
	 * @param {Readonly<Vector2D>} other Another vector to subtract.
	 * @returns {this} The updated vector.
	 * 
	 * Subtracts another vector from the current vector.
	 * @overload
	 * @param {Readonly<Vector3D>} other Another vector to subtract.
	 * @returns {this} The updated vector.
	 */
	/**
	 * @param {[number | Readonly<Vector1D> | Readonly<Vector2D> | Readonly<Vector3D>]} args 
	 * @returns {this}
	 */
	["-="](...args) {
		const [arg1] = args;
		if (arg1 instanceof Vector3D) {
			this.x -= arg1.x;
			this.y -= arg1.y;
			this.z -= arg1.z;
			return this;
		}
		if (arg1 instanceof Vector2D) {
			this.x -= arg1.x;
			this.y -= arg1.y;
			return this;
		}
		if (arg1 instanceof Vector1D) {
			this.x -= arg1.x;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.x -= arg1;
			this.y -= arg1;
			this.z -= arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	/**
	 * Multiplies the current vector by a scalar.
	 * @overload
	 * @param {number} scalar A scalar value to multiply by.
	 * @returns {this} The updated vector.
	 * 
	 * Multiplies the current vector by another vector.
	 * @overload
	 * @param {Readonly<Vector1D>} other Another vector to multiply by.
	 * @returns {this} The updated vector.
	 * 
	 * Multiplies the current vector by another vector.
	 * @overload
	 * @param {Readonly<Vector2D>} other Another vector to multiply by.
	 * @returns {this} The updated vector.
	 * 
	 * Multiplies the current vector by another vector.
	 * @overload
	 * @param {Readonly<Vector3D>} other Another vector to multiply by.
	 * @returns {this} The updated vector.
	 */
	/**
	 * @param {[number | Readonly<Vector1D> | Readonly<Vector2D> | Readonly<Vector3D>]} args 
	 * @returns {this}
	 */
	["*="](...args) {
		const [arg1] = args;
		if (arg1 instanceof Vector3D) {
			this.x *= arg1.x;
			this.y *= arg1.y;
			this.z *= arg1.z;
			return this;
		}
		if (arg1 instanceof Vector2D) {
			this.x *= arg1.x;
			this.y *= arg1.y;
			return this;
		}
		if (arg1 instanceof Vector1D) {
			this.x *= arg1.x;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.x *= arg1;
			this.y *= arg1;
			this.z *= arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	/**
	 * Divides the current vector by a scalar.
	 * @overload
	 * @param {number} scalar A scalar value to divide by.
	 * @returns {this} The updated vector.
	 * 
	 * Divides the current vector by another vector.
	 * @overload
	 * @param {Readonly<Vector1D>} other Another vector to divide by.
	 * @returns {this} The updated vector.
	 * 
	 * Divides the current vector by another vector.
	 * @overload
	 * @param {Readonly<Vector2D>} other Another vector to divide by.
	 * @returns {this} The updated vector.
	 * 
	 * Divides the current vector by another vector.
	 * @overload
	 * @param {Readonly<Vector3D>} other Another vector to divide by.
	 * @returns {this} The updated vector.
	 */
	/**
	 * @param {[number | Readonly<Vector1D> | Readonly<Vector2D> | Readonly<Vector3D>]} args 
	 * @returns {this}
	 */
	["/="](...args) {
		const [arg1] = args;
		if (arg1 instanceof Vector3D) {
			this.x /= arg1.x;
			this.y /= arg1.y;
			this.z /= arg1.z;
			return this;
		}
		if (arg1 instanceof Vector2D) {
			this.x /= arg1.x;
			this.y /= arg1.y;
			return this;
		}
		if (arg1 instanceof Vector1D) {
			this.x /= arg1.x;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.x /= arg1;
			this.y /= arg1;
			this.z /= arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	//#endregion
}
//#endregion

//#region Timespan
/**
 * Represents a duration of time.
 */
class Timespan {
	//#region Converters
	/**
	 * @param {number} hours integer
	 * @param {number} minutes integer
	 * @param {number} seconds integer
	 * @param {number} milliseconds integer
	 * @returns {[number, number, number, number]} [0 - +∞), [0 - 59], [0 - 59], [0 - 999]
	 */
	static #fixTimeOffset(hours, minutes, seconds, milliseconds) {
		seconds += trunc(milliseconds / 1000);
		milliseconds %= 1000;
		minutes += trunc(seconds / 60);
		seconds %= 60;
		hours += trunc(minutes / 60);
		minutes %= 60;
		return [hours, minutes, seconds, milliseconds];
	}
	/**
	 * @param {number} duration integer
	 * @returns {[boolean, number, number, number, number]} boolean, [0 - +∞), [0 - 59], [0 - 59], [0 - 999]
	 */
	static #toTime(duration) {
		const negativity = duration < 0;
		duration = abs(duration);
		const milliseconds = duration % 1000;
		duration = trunc(duration / 1000);
		const seconds = duration % 60;
		duration = trunc(duration / 60);
		const minutes = duration % 60;
		duration = trunc(duration / 60);
		const hours = duration;
		return [negativity, hours, minutes, seconds, milliseconds];
	}
	/**
	 * @param {boolean} negativity boolean
	 * @param {number} hours [0 - +∞)
	 * @param {number} minutes [0 - 59]
	 * @param {number} seconds [0 - 59]
	 * @param {number} milliseconds [0 - 999]
	 * @returns {number} integer
	 */
	static #toDuration(negativity, hours, minutes, seconds, milliseconds) {
		return (negativity ? -1 : 1) * ((((hours) * 60 + minutes) * 60 + seconds) * 1000 + milliseconds);
	}
	//#endregion
	//#region Operations
	/**
	 * Adds two timespans and returns the result as a new Timespan.
	 * @param {Readonly<Timespan>} first The first timespan to add.
	 * @param {Readonly<Timespan>} second The second timespan to add.
	 * @returns {Timespan} A new Timespan representing the sum of the two timespans.
	 */
	static ["+"](first, second) {
		return new Timespan(first)["+="](second);
	}
	/**
	 * Subtracts the second timespan from the first and returns the result as a new Timespan.
	 * @param {Readonly<Timespan>} first The timespan from which the second will be subtracted.
	 * @param {Readonly<Timespan>} second The timespan to subtract.
	 * @returns {Timespan} A new Timespan representing the difference between the two timespans.
	 */
	static ["-"](first, second) {
		return new Timespan(first)["-="](second);
	}
	/**
	 * Multiplies two timespans and returns the result as a new Timespan.
	 * @param {Readonly<Timespan>} first The first timespan to multiply.
	 * @param {Readonly<Timespan>} second The second timespan to multiply.
	 * @returns {Timespan} A new Timespan representing the product of the two timespans.
	 */
	static ["*"](first, second) {
		return new Timespan(first)["*="](second);
	}
	/**
	 * Divides the first timespan by the second and returns the result as a new Timespan.
	 * @param {Readonly<Timespan>} first The timespan to be divided.
	 * @param {Readonly<Timespan>} second The timespan to divide by.
	 * @returns {Timespan} A new Timespan representing the result of the division.
	 */
	static ["/"](first, second) {
		return new Timespan(first)["/="](second);
	}
	//#endregion
	//#region Presets
	/**
	 * Represents a new zero timespan.
	 * @readonly
	 * @returns {Timespan}
	 */
	static get newZero() { return Timespan.viaTime(false, 0, 0, 0, 0); };
	/**
	 * Represents a new timespan of one millisecond.
	 * @readonly
	 * @returns {Timespan}
	 */
	static get newMillisecond() { return Timespan.viaTime(false, 0, 0, 0, 1); };
	/**
	 * Represents a new timespan of one second.
	 * @readonly
	 * @returns {Timespan}
	 */
	static get newSecond() { return Timespan.viaTime(false, 0, 0, 1, 0); };
	/**
	 * Represents a new timespan of one minute.
	 * @readonly
	 * @returns {Timespan}
	 */
	static get newMinute() { return Timespan.viaTime(false, 0, 1, 0, 0); };
	/**
	 * Represents a new timespan of one hour.
	 * @readonly
	 * @returns {Timespan}
	 */
	static get newHour() { return Timespan.viaTime(false, 1, 0, 0, 0); };
	/**
	 * Represents a new timespan of one day.
	 * @readonly
	 * @returns {Timespan}
	 */
	static get newDay() { return Timespan.viaTime(false, 24, 0, 0, 0); };
	//#endregion
	//#region Builders
	/** @type {RegExp} */
	static #patternTimespan = /^(-)?(?:(?:(\d+):)?(\d+):)?(\d+)(?:\.(\d+))?$/;
	/**
	 * Parses a string representation into a Timespan object.
	 * @param {string} string The string to parse.
	 * @returns {Timespan} The parsed Timespan object.
	 * @throws {SyntaxError} If the string has invalid syntax.
	 */
	static parse(string) {
		const match = Timespan.#patternTimespan.exec(string);
		if (match === null) throw new SyntaxError(`Invalid time '${string}' syntax`);
		const negativity = (match[1] !== undefined);
		const [, , hours, minutes, seconds, milliseconds] = match.map(part => Number(part ?? 0));
		return Timespan.viaTime(negativity, hours, minutes, seconds, milliseconds);
	}
	/**
	 * Creates a Timespan object from a duration.
	 * @param {number} duration The duration in milliseconds.
	 * @returns {Timespan} The Timespan object.
	 * @throws {TypeError} If the duration is not a finite number.
	 */
	static viaDuration(duration = 0) {
		if (!Number.isFinite(duration)) throw new TypeError(`The duration ${duration} must be a finite number`);
		const timespan = new Timespan();
		timespan.#duration = trunc(duration);
		[timespan.#negativity, timespan.#hours, timespan.#minutes, timespan.#seconds, timespan.#milliseconds] = Timespan.#toTime(timespan.#duration);
		return timespan;
	}
	/**
	 * Creates a Timespan object from individual time components.
	 * @param {boolean} negativity Whether the timespan is negative.
	 * @param {number} hours The hours component.
	 * @param {number} minutes The minutes component.
	 * @param {number} seconds The seconds component.
	 * @param {number} milliseconds The milliseconds component.
	 * @returns {Timespan} The Timespan object.
	 * @throws {TypeError} If any of the parameters is not a finite number.
	 */
	static viaTime(negativity = false, hours = 0, minutes = 0, seconds = 0, milliseconds = 0) {
		if (!Number.isFinite(hours)) throw new TypeError(`The hours ${hours} must be a finite number`);
		if (!Number.isFinite(minutes)) throw new TypeError(`The minutes ${minutes} must be a finite number`);
		if (!Number.isFinite(seconds)) throw new TypeError(`The seconds ${seconds} must be a finite number`);
		if (!Number.isFinite(milliseconds)) throw new TypeError(`The milliseconds ${milliseconds} must be a finite number`);
		const timespan = new Timespan();
		timespan.#negativity = negativity;
		[timespan.#hours, timespan.#minutes, timespan.#seconds, timespan.#milliseconds] = Timespan.#fixTimeOffset(trunc(hours), trunc(minutes), trunc(seconds), trunc(milliseconds));
		timespan.#duration = Timespan.#toDuration(timespan.#negativity, timespan.#hours, timespan.#minutes, timespan.#seconds, timespan.#milliseconds);
		return timespan;
	}
	/**
	 * @overload
	 * 
	 * @overload
	 * @param {Readonly<Timespan>} source The source Timespan object.
	 */
	/**
	 * @param {Readonly<Timespan> | void} arg1 
	 */
	constructor(arg1) {
		if (arg1 instanceof Timespan) {
			this.#duration = arg1.duration;
			this.#negativity = arg1.negativity;
			this.#hours = arg1.hours;
			this.#minutes = arg1.minutes;
			this.#seconds = arg1.seconds;
			this.#milliseconds = arg1.milliseconds;
			return;
		}
		if (typeof (arg1) === `undefined`) {
			this.#duration = 0;
			this.#negativity = false;
			this.#hours = 0;
			this.#minutes = 0;
			this.#seconds = 0;
			this.#milliseconds = 0;
			return;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	//#endregion
	//#region Properties
	/** @type {number} */
	#duration;
	/**
	 * Gets the duration of the timespan in milliseconds.
	 * @type {number}
	 */
	get duration() {
		return this.#duration;
	}
	/**
	 * Sets the duration of the timespan in milliseconds.
	 * @param {number} value The duration value to set.
	 */
	set duration(value) {
		if (!Number.isFinite(value)) return;
		this.#duration = trunc(value);
		[this.#negativity, this.#hours, this.#minutes, this.#seconds, this.#milliseconds] = Timespan.#toTime(this.#duration);
	}
	/** @type {boolean} */
	#negativity;
	/**
	 * Gets whether the timespan is negative.
	 * @type {boolean}
	 */
	get negativity() {
		return this.#negativity;
	}
	/**
	 * Sets whether the timespan is negative.
	 * @param {boolean} value The negativity value to set.
	 */
	set negativity(value) {
		this.#negativity = value;
		this.#duration = Timespan.#toDuration(this.#negativity, this.#hours, this.#minutes, this.#seconds, this.#milliseconds);
	}
	/** @type {number} */
	#hours;
	/**
	 * Gets the hours component of the timespan.
	 * @type {number}
	 */
	get hours() {
		return this.#hours;
	}
	/**
	 * Sets the hours component of the timespan.
	 * @param {number} value The hours value to set.
	 */
	set hours(value) {
		if (!Number.isFinite(value)) return;
		[this.#hours, this.#minutes, this.#seconds, this.#milliseconds] = Timespan.#fixTimeOffset(trunc(value), this.#minutes, this.#seconds, this.#milliseconds);
		this.#duration = Timespan.#toDuration(this.#negativity, this.#hours, this.#minutes, this.#seconds, this.#milliseconds);
	}
	/** @type {number} */
	#minutes;
	/**
	 * Gets the minutes component of the timespan.
	 * @type {number}
	 */
	get minutes() {
		return this.#minutes;
	}
	/**
	 * Sets the minutes component of the timespan.
	 * @param {number} value The minutes value to set.
	 */
	set minutes(value) {
		if (!Number.isFinite(value)) return;
		[this.#hours, this.#minutes, this.#seconds, this.#milliseconds] = Timespan.#fixTimeOffset(this.#hours, trunc(value), this.#seconds, this.#milliseconds);
		this.#duration = Timespan.#toDuration(this.#negativity, this.#hours, this.#minutes, this.#seconds, this.#milliseconds);
	}
	/** @type {number} */
	#seconds;
	/**
	 * Gets the seconds component of the timespan.
	 * @type {number}
	 */
	get seconds() {
		return this.#seconds;
	}
	/**
	 * Sets the seconds component of the timespan.
	 * @param {number} value The seconds value to set.
	 */
	set seconds(value) {
		if (!Number.isFinite(value)) return;
		[this.#hours, this.#minutes, this.#seconds, this.#milliseconds] = Timespan.#fixTimeOffset(this.#hours, this.#minutes, trunc(value), this.#milliseconds);
		this.#duration = Timespan.#toDuration(this.#negativity, this.#hours, this.#minutes, this.#seconds, this.#milliseconds);
	}
	/** @type {number} */
	#milliseconds;
	/**
	 * Gets the milliseconds component of the timespan.
	 * @type {number}
	 */
	get milliseconds() {
		return this.#milliseconds;
	}
	/**
	 * Sets the milliseconds component of the timespan.
	 * @param {number} value The milliseconds value to set.
	 */
	set milliseconds(value) {
		if (!Number.isFinite(value)) return;
		[this.#hours, this.#minutes, this.#seconds, this.#milliseconds] = Timespan.#fixTimeOffset(this.#hours, this.#minutes, this.#seconds, trunc(value));
		this.#duration = Timespan.#toDuration(this.#negativity, this.#hours, this.#minutes, this.#seconds, this.#milliseconds);
	}
	//#endregion
	//#region Modifiers
	/**
	 * Converts the timespan to a string representation.
	 * @param {boolean} full Determines whether to include all time components or not. Default is true.
	 * @returns {string} The string representation of the timespan.
	 */
	toString(full = true) {
		const { negativity, hours, minutes, seconds, milliseconds } = this;
		let string = seconds.toFixed().padStart(2, `0`);
		if (full || milliseconds > 0) {
			string = `${string}.${milliseconds.toFixed().padStart(3, `0`)}`;
		}
		if (full || hours > 0) {
			string = `${minutes.toFixed().padStart(2, `0`)}:${string}`;
			string = `${hours.toFixed().padStart(2, `0`)}:${string}`;
		} else if (minutes > 0) {
			string = `${minutes.toFixed().padStart(2, `0`)}:${string}`;
		}
		if (negativity) {
			string = `-${string}`;
		}
		return string;
	}
	/**
	 * Converts the timespan to a primitive type based on the provided hint.
	 * @template {keyof PrimitivesHintMap} K
	 * @overload
	 * @param {K} hint The hint for the primitive type.
	 * @returns {PrimitivesHintMap[K]} The corresponding primitive value.
	 */
	/**
	 * @template {keyof PrimitivesHintMap} K
	 * @param {K} hint 
	 * @returns {PrimitivesHintMap[keyof PrimitivesHintMap]}
	 */
	[Symbol.toPrimitive](hint) {
		switch (hint) {
			case `number`: return this.#duration;
			case `boolean`: return Boolean(this.#duration);
			case `string`: return this.toString();
			default: throw new TypeError(`Invalid '${hint}' primitive hint`);
		}
	}
	/**
	 * Adds a number of milliseconds to this timespan.
	 * @overload
	 * @param {number} duration The duration to add in milliseconds.
	 * @returns {this} The updated timespan.
	 * 
	 * Adds another timespan to this timespan.
	 * @overload
	 * @param {Readonly<Timespan>} other The timespan to add.
	 * @returns {this} The updated timespan.
	 */
	/**
	 * @param {[number | Readonly<Timespan>]} args 
	 * @returns {this}
	 */
	["+="](...args) {
		const [arg1] = args;
		if (arg1 instanceof Timespan) {
			this.duration += arg1.duration;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.duration += arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	/**
	 * Subtracts a number of milliseconds from this timespan.
	 * @overload
	 * @param {number} duration The duration to subtract in milliseconds.
	 * @returns {this} The updated timespan.
	 * 
	 * Subtracts another timespan from this timespan.
	 * @overload
	 * @param {Readonly<Timespan>} other The timespan to subtract.
	 * @returns {this} The updated timespan.
	 */
	/**
	 * @param {[number | Readonly<Timespan>]} args 
	 * @returns {this}
	 */
	["-="](...args) {
		const [arg1] = args;
		if (arg1 instanceof Timespan) {
			this.duration -= arg1.duration;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.duration -= arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	/**
	 * Multiplies this timespan by a number of milliseconds.
	 * @overload
	 * @param {number} duration The duration to multiply by.
	 * @returns {this} The updated timespan.
	 * 
	 * Multiplies this timespan by another timespan.
	 * @overload
	 * @param {Readonly<Timespan>} other The timespan to multiply by.
	 * @returns {this} The updated timespan.
	 */
	/**
	 * @param {[number | Readonly<Timespan>]} args 
	 * @returns {this}
	 */
	["*="](...args) {
		const [arg1] = args;
		if (arg1 instanceof Timespan) {
			this.duration *= arg1.duration;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.duration *= arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	/**
	 * Divides this timespan by a number of milliseconds.
	 * @overload
	 * @param {number} duration The duration to divide by.
	 * @returns {this} The updated timespan.
	 * 
	 * Divides this timespan by another timespan.
	 * @overload
	 * @param {Readonly<Timespan>} other The timespan to divide by.
	 * @returns {this} The updated timespan.
	 */
	/**
	 * @param {[number | Readonly<Timespan>]} args 
	 * @returns {this}
	 */
	["/="](...args) {
		const [arg1] = args;
		if (arg1 instanceof Timespan) {
			this.duration /= arg1.duration;
			return this;
		}
		if (typeof (arg1) === `number`) {
			this.duration /= arg1;
			return this;
		}
		throw new TypeError(`No overload with [${typename(arg1)}] arguments`);
	}
	//#endregion
}
//#endregion

//#region Matrix
/**
 * Represents a matrix with generic data type.
 * @template T
 */
class Matrix {
	/**
	 * @param {Readonly<Vector2D>} size The size of the matrix.
	 * @param {(position: Vector2D) => T} initializer The value initializer for all elements in the matrix.
	 * @throws {TypeError} If the x or y coordinate of the size is not an integer.
	 * @throws {RangeError} If the x or y coordinate of the size is negative.
	 */
	constructor(size, initializer) {
		if (!Vector.isInteger(size)) throw new TypeError(`The size ${size} must be a finite integer vector`);
		if (0 > size.x || 0 > size.y) throw new RangeError(`The size ${size} is out of range [(0, 0) - (+∞, +∞))`);
		this.#size = size;
		/** @type {T[][]} */
		const data = (this.#data = new Array(size.y));
		for (let y = 0; y < data.length; y++) {
			/** @type {T[]} */
			const row = (data[y] = new Array(size.x));
			for (let x = 0; x < row.length; x++) {
				row[x] = initializer(new Vector2D(x, y));
			}
		}
	}
	/** @type {Readonly<Vector2D>} */
	#size;
	/** 
	 * Gets the size of the matrix.
	 * @readonly 
	 * @returns {Readonly<Vector2D>} The size of the matrix.
	 */
	get size() {
		return this.#size;
	}
	/** @type {T[][]} */
	#data;
	/**
	 * Gets the value at the specified position in the matrix.
	 * @param {Readonly<Vector2D>} position The position to get the value from.
	 * @returns {T} The value at the specified position.
	 * @throws {TypeError} If the x or y coordinate of the position is not an integer.
	 * @throws {RangeError} If the x or y coordinate of the position is out of range.
	 */
	get(position) {
		if (!Vector.isInteger(position)) throw new TypeError(`The position ${position} must be a finite integer vector`);
		const { x, y } = position;
		const size = this.#size;
		if (0 > x || x >= size.x || 0 > y || y >= size.y) throw new RangeError(`The position ${position} is out of range [(0, 0) - ${size})`);
		return this.#data[y][x];
	}
	/**
	 * Sets the value at the specified position in the matrix.
	 * @param {Readonly<Vector2D>} position The position to set the value at.
	 * @param {T} value The value to set.
	 * @throws {TypeError} If the x or y coordinate of the position is not an integer.
	 * @throws {RangeError} If the x or y coordinate of the position is out of range.
	 */
	set(position, value) {
		if (!Vector.isInteger(position)) throw new TypeError(`The position ${position} must be a finite integer vector`);
		const { x, y } = position;
		const size = this.#size;
		if (0 > x || x >= size.x || 0 > y || y >= size.y) throw new RangeError(`The position ${position} is out of range [(0, 0) - ${size})`);
		this.#data[y][x] = value;
	}
	/**
	 * Updates a value at a specified position using a callback.
	 * @param {Readonly<Vector2D>} position The position to modify.
	 * @param {(value: T) => T} callback Function to compute the new value.
	 * @throws {TypeError} If the x or y coordinate of the position is not an integer.
	 * @throws {RangeError} If the x or y coordinate of the position is out of range.
	 */
	change(position, callback) {
		if (!Vector.isInteger(position)) throw new TypeError(`The position ${position} must be a finite integer vector`);
		const { x, y } = position;
		const size = this.#size;
		if (0 > x || x >= size.x || 0 > y || y >= size.y) throw new RangeError(`The position ${position} is out of range [(0, 0) - ${size})`);
		this.#data[y][x] = callback(this.#data[y][x]);
	}
	/**
	 * Iterates over each element in the matrix and applies a callback function.
	 * @param {(value: T, position: Vector2D, matrix: Matrix<T>) => void} callback 
	 * @returns {void}
	 */
	forEach(callback) {
		const size = this.#size;
		const position = Vector2D.newNaN;
		for (let y = 0; y < size.y; y++) {
			for (let x = 0; x < size.x; x++) {
				position.x = x;
				position.y = y;
				callback(this.#data[y][x], position, this);
			}
		}
	}
}
//#endregion

export { Vector, Vector1D, Vector2D, Vector3D, Timespan, Matrix };
