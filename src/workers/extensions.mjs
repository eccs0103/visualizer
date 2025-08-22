/// <reference path="./declarations.d.ts" />

"use strict";

//#region Promise
/**
 * Creates a promise that resolves after the specified timeout.
 * @param {number} timeout The timeout in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the timeout.
 */
Promise.withTimeout = async function (timeout) {
	const { promise, resolve } = Promise.withResolvers();
	let index;
	try {
		index = setTimeout(resolve, timeout);
		return await promise;
	} finally {
		clearTimeout(index);
	}
};

/**
 * Creates a promise that can be controlled with an abort signal.
 * @template T
 * @param {(signal: AbortSignal, resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void} callback The callback to execute with an abort signal, resolve, and reject functions.
 * @returns {Promise<T>} A promise that can be controlled with an abort signal.
 */
Promise.withSignal = async function (callback) {
	const controller = new AbortController();
	const { promise, resolve, reject } = Promise.withResolvers();
	try {
		callback(controller.signal, resolve, reject);
		return await promise;
	} finally {
		controller.abort();
	}
};
//#endregion

export { };
