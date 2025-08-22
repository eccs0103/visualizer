/// <reference path="./extensions.js" />

interface PromiseConstructor {
	/**
	 * Creates a promise that resolves after the specified timeout.
	 * @param timeout The timeout in milliseconds.
	 * @returns A promise that resolves after the timeout.
	 */
	withTimeout(timeout: number): Promise<void>;
	/**
	 * Creates a promise that can be controlled with an abort signal.
	 * @template T
	 * @param callback The callback to execute with an abort signal, resolve, and reject functions.
	 * @returns A promise that can be controlled with an abort signal.
	 */
	withSignal<T>(callback: (signal: AbortSignal, resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void): Promise<T>;
}
