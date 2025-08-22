/// <reference path="./extensions.js" />

/**
 * A mapping interface that associates primitive types with string keys.
 * This is used to handle conversions to different primitive types.
 */
interface PrimitivesHintMap {
	"number": number;
	"boolean": boolean;
	"string": string;
}

interface NumberConstructor {
	/**
	 * Imports a number from a source.
	 * @param source The source value to import.
	 * @param name The name of the source value.
	 * @returns The imported number value.
	 * @throws {ReferenceError} If the source is undefined.
	 * @throws {TypeError} If the source is not a number.
	 */
	import(source: any, name?: string): number;
}

interface Number {
	/**
	 * Exports the number value.
	 * @returns The exported number value.
	 */
	export(): number;
	/**
	 * Clamps a value between a minimum and maximum.
	 * @param min The minimum value.
	 * @param max The maximum value.
	 * @returns The clamped value.
	 */
	clamp(min: number, max: number): number;
	/**
	 * Interpolates the number from one range to another.
	 * @param min1 The minimum value of the original range.
	 * @param max1 The maximum value of the original range.
	 * @param min2 The minimum value of the target range. Defaults to 0.
	 * @param max2 The maximum value of the target range. Defaults to 1.
	 * @returns The interpolated value within the target range.
	 * @throws {Error} If the minimum and maximum of either range are equal.
	 */
	interpolate(min1: number, max1: number, min2?: number, max2?: number): number;
	/**
	 * Modulates the current number within a specified range.
	 * @param length The range length.
	 * @param start The start of the range. Defaults to 0.
	 * @returns The number constrained within the range.
	 * @throws {Error} If the range is zero.
	 */
	modulate(length: number, start?: number): number;
	/**
	 * Returns the current number or a default value if the current number is NaN.
	 * @param value The default value to return if the current number is NaN.
	 * @returns The current number if it is not NaN, otherwise the default value.
	 */
	orDefault(value: number): number;
}

interface BooleanConstructor {
	/**
	 * Imports a boolean value from a source.
	 * @param source The source value to import.
	 * @param name The name of the source value.
	 * @returns The imported boolean value.
	 * @throws {ReferenceError} If the source is undefined.
	 * @throws {TypeError} If the source is not a boolean.
	 */
	import(source: any, name?: string): boolean;
}

interface Boolean {
	/**
	 * Exports the boolean value.
	 * @returns The exported boolean value.
	 */
	export(): boolean;
}

interface StringConstructor {
	/**
	 * Imports a string from a source.
	 * @param source The source value to import.
	 * @param name The name of the source value.
	 * @returns The imported string value.
	 * @throws {ReferenceError} If the source is undefined.
	 * @throws {TypeError} If the source is not a string.
	 */
	import(source: any, name?: string): string;
	/**
	 * A constant empty string.
	 */
	readonly empty: string;
	/**
	 * Checks if a string is empty.
	 * @param text The string to check.
	 * @returns True if the string is empty, otherwise false.
	 */
	isEmpty(text: string): boolean;
	/**
	 * Checks if a string contains only whitespace characters.
	 * @param text The string to check.
	 * @returns True if the string is empty or contains only whitespace, otherwise false.
	 */
	isWhitespace(text: string): boolean;
}

interface String {
	/**
	 * Exports the string value.
	 * @returns The exported string value.
	 */
	export(): string;
	/**
	 * Returns the current string value or a default value if the string is empty.
	 * @param value The default value to return if the string is empty.
	 * @returns The current string value or the provided default value.
	 */
	orDefault(value: string): string;
	/**
	 * Converts the string to title case, where the first letter of each word is capitalized.
	 * @returns The string converted to title case.
	 */
	toTitleCase(): string;
	/**
	 * Converts the string to title case based on the specified locale(s), capitalizing the first letter of each word.
	 * @param locales A single locale or an array of locales for locale-aware case conversion.
	 * @returns The string converted to title case with locale-awareness.
	 */
	toLocalTitleCase(locales?: string | string[]): string;
	/**
	 * Converts the string to title case based on the specified locale(s), capitalizing the first letter of each word.
	 * @param locales An argument supported by `Intl` for locale-aware case conversion.
	 * @returns The string converted to title case with locale-awareness.
	 */
	toLocalTitleCase(locales?: Intl.LocalesArgument): string;
	/**
	 * Reverses the string.
	 * @returns The reversed string.
	 */
	reverse(): string;
}

/**
 * Interface representing an instance that can be archived.
 * @template N The type of the archived data.
 */
interface ArchivableInstance<N> {
	/**
	 * Exports the instance.
	 * @returns The exported data.
	 */
	export(): N;
}

/**
 * Interface representing a prototype that can create archivable instances.
 * @template N The type of the archived data.
 * @template I The type of the archivable instance.
 * @template A The types of the constructor arguments for the instance.
 */
interface ArchivablePrototype<N, I extends ArchivableInstance<N>, A extends readonly any[]> {
	/**
	 * Imports data and creates an instance.
	 * @param source The source data to import.
	 * @param name An optional name for the source.
	 * @returns The created instance.
	 */
	import(source: any, name?: string): I;
	/**
	 * @param args The constructor arguments.
	 */
	new(...args: A): I;
}

interface ObjectConstructor {
	/**
	 * Imports an object from a source.
	 * @param source The source to import from.
	 * @param name The name of the source.
	 * @returns The imported object.
	 * @throws {ReferenceError} Throws a ReferenceError if the source is undefined.
	 * @throws {TypeError} Throws a TypeError if the source is not an object or null.
	 */
	import(source: any, name?: string): object;
	/**
	 * Applies a callback function to a non-nullable value, or returns the original nullable value.
	 * @template T The type of the input value.
	 * @template N The type representing nullable.
	 * @template R The return type of the callback function.
	 * @param value The value to map.
	 * @param callback The function to apply if the value is non-nullable.
	 * @returns The mapped result.
	 */
	map<T, N extends Exclude<T, NonNullable<T>>, R>(value: NonNullable<T> | N, callback: (object: NonNullable<T>) => R): R | N;
	/**
	 * Ensures that a value is neither null nor undefined, throwing an error if it is.
	 * @template T
	 * @param value The value to check.
	 * @param name The name of the value, used in error messages.
	 * @returns The value if it is not null or undefined.
	 * @throws {Error} If the value is null or undefined.
	 */
	suppress<T>(value: T, name?: string): NonNullable<T>;
}

interface Object {
	/**
	 * Exports the object.
	 * @returns The exported object.
	 */
	export(): object;
}

interface IteratorConstructor {
	/**
	 * Generates a range of integers between the specified minimum and maximum values (exclusive).
	 * @param min The minimum value of the range (inclusive).
	 * @param max The maximum value of the range (exclusive).
	 * @returns A generator yielding integers in the specified range.
	 */
	range(min: number, max: number): Generator<number>;
}

interface ArrayConstructor {
	/**
	 * Imports an array from a source.
	 * @param source The source to import from.
	 * @param name The name of the source.
	 * @returns The imported array.
	 * @throws {ReferenceError} Throws a ReferenceError if the source is undefined.
	 * @throws {TypeError} Throws a TypeError if the source is not an array.
	 */
	import(source: any, name?: string): any[];
	/**
	 * Creates an array of integers between the specified minimum and maximum values (exclusive).
	 * @param min The minimum value of the range (inclusive).
	 * @param max The maximum value of the range (exclusive).
	 * @returns An array containing integers in the specified range.
	 */
	range(min: number, max: number): number[];
}

interface Array<T> {
	/**
	 * Exports the array.
	 * @returns The exported array.
	 */
	export(): T[];
	/**
	 * Swaps the elements at the given indices in the array.
	 * @param index1 The index of the first element.
	 * @param index2 The index of the second element.
	 */
	swap(index1: number, index2: number): void;
	/**
	 * Resizes an array to the specified length. 
	 * If the new length is greater than the current length, fills the extra slots with the default value.
	 * If the new length is smaller, truncates the array.
	 * @template T
	 * @param length The new length for the array.
	 * @param _default The default value to fill new slots if the array is extended.
	 * @returns The resized array.
	 */
	resize(length: number, _default: T): T[];
}

interface Math {
	/**
	 * Splits a number into its integer and fractional parts.
	 * @param x The number to be split.
	 * @returns A tuple where the first element is the integer part and the second element is the fractional part.
	 * ```ts
	 * const [integer, fractional] = Math.split(x);
	 * ```
	 */
	split(x: number): [number, number];
	/**
	 * Calculates the square of a number.
	 * @param x The number to square.
	 */
	sqpw(x: number): number;
	/**
	 * Converts radians to degrees.
	 * @param radians The angle in radians.
	 */
	toDegrees(radians: number): number;
	/**
	 * Converts degrees to radians.
	 * @param degrees The angle in degrees.
	 */
	toRadians(degrees: number): number;
	/**
	 * Calculates the arithmetic mean of the given numbers.
	 * @param values The numbers to calculate the mean from.
	 */
	meanArithmetic(...values: number[]): number;
	/**
	 * Calculates the geometric mean of the given numbers.
	 * @param values The numbers to calculate the mean from.
	 */
	meanGeometric(...values: number[]): number;
	/**
	 * Calculates the harmonic mean of the given numbers.
	 * @param values The numbers to calculate the mean from.
	 */
	meanHarmonic(...values: number[]): number;
}

interface Promise<T> {
	/**
	 * Checks if the promise is fulfilled.
	 */
	readonly isFulfilled: Promise<boolean>;
	/**
	 * Retrieves the value of a resolved promise.
	 * @throws {Error} Throws an error if the promise is rejected.
	 */
	readonly value: Promise<T>;
	/**
	 * Retrieves the reason of a rejected promise.
	 * @throws {Error} Throws an error if the promise is fulfilled.
	 */
	readonly reason: Promise<any>;
}

interface ErrorConstructor {
	/**
	 * Generates an error object from the provided input.
	 * @param reason The reason input.
	 */
	from(reason: any): Error;
	/**
	 * Throws an error based on the provided input.
	 * @param reason The reason for the error.
	 */
	throws(reason?: any): never;
}

interface Error {
	/**
	 * Returns a string representation of the Error object.
	 * @returns A string representation of the Error object.
	 */
	toString(): string;
}

namespace globalThis {
	/**
	 * Returns the prototype of the given non-nullable value.
	 * @template T
	 * @param value The value whose prototype is to be retrieved. It cannot be null or undefined.
	 */
	function prototype<T>(value: NonNullable<T>): Function;
	/**
	 * Gets the type name of a value.
	 * @param value The value to get the type name of.
	 * @returns The type name of the value.
	 */
	function typename(value: any): string;
}
