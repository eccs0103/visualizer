"use strict";

import { ImplementationError } from "../core/extensions.js";

const { trunc } = Math;

//#region Engine
/**
 * @typedef {object} EngineEventMap
 * @property {Event} start
 * @property {Event} trigger
 * @property {Event} launch
 * @property {Event} change
 */

/**
 * Base class for engines.
 * @abstract
 */
class Engine extends EventTarget {
	constructor() {
		super();
		if (new.target === Engine) throw new TypeError(`Unable to create an instance of an abstract class`);
	}
	/**
	 * @template {keyof EngineEventMap} K
	 * @overload
	 * @param {K} type 
	 * @param {(this: Engine, ev: EngineEventMap[K]) => any} listener 
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
	 * @template {keyof EngineEventMap} K
	 * @overload
	 * @param {K} type 
	 * @param {(this: Engine, ev: EngineEventMap[K]) => any} listener 
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
	/**
	 * Gets the launch status of the engine.
	 * @abstract
	 * @returns {boolean}
	 */
	get launched() {
		throw new ImplementationError();
	}
	/**
	 * Sets the launch status of the engine.
	 * @abstract
	 * @param {boolean} value
	 * @returns {void}
	 */
	set launched(value) {
		throw new ImplementationError();
	}
	/**
	 * Gets the FPS limit of the engine.
	 * @abstract
	 * @returns {number}
	 */
	get limit() {
		throw new ImplementationError();
	}
	/**
	 * Sets the FPS limit of the engine.
	 * @abstract
	 * @param {number} value
	 * @returns {void}
	 */
	set limit(value) {
		throw new ImplementationError();
	}
	/**
	 * Gets the Frames Per Second  of the engine.
	 * @abstract
	 * @returns {number}
	 */
	get fps() {
		throw new ImplementationError();
	}
	/**
	 * Gets the time delta between frames.
	 * @abstract
	 * @readonly
	 * @returns {number}
	 */
	get delta() {
		throw new ImplementationError();
	}
}
//#endregion
//#region Fast engine
/**
 * @typedef {{ }} Extendable.FastEngineEventMap
 * 
 * @typedef {EngineEventMap & Extendable.FastEngineEventMap} FastEngineEventMap
 */

/**
 * Constructs a fast type engine.
 */
class FastEngine extends Engine {
	/**
	 * @param {boolean} launch Whether the engine should be launched initially. Default is false.
	 */
	constructor(launch = false) {
		super();

		this.#launched = launch;
		this.addEventListener(`trigger`, event => this.dispatchEvent(new Event(`start`)), { once: true });
		requestAnimationFrame(this.#callback.bind(this));
	}
	/**
	 * @template {keyof FastEngineEventMap} K
	 * @overload
	 * @param {K} type 
	 * @param {(this: FastEngine, ev: FastEngineEventMap[K]) => any} listener 
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
	 * @template {keyof FastEngineEventMap} K
	 * @overload
	 * @param {K} type 
	 * @param {(this: FastEngine, ev: FastEngineEventMap[K]) => any} listener 
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
	#launched;
	/**
	 * Gets the launch status of the engine.
	 * @returns {boolean}
	 */
	get launched() {
		return this.#launched;
	}
	/**
	 * Sets the launch status of the engine.
	 * @param {boolean} value 
	 * @returns {void}
	 */
	set launched(value) {
		const previous = this.#launched;
		this.#launched = value;
		if (previous !== value) this.dispatchEvent(new Event(`change`));
		if (value) this.dispatchEvent(new Event(`launch`));
	}
	/** @type {number} */
	#previous = 0;
	/**
	 * @param {DOMHighResTimeStamp} current 
	 * @returns {void}
	 */
	#callback(current) {
		const difference = current - this.#previous;
		if (difference > this.#gap) {
			if (this.launched) {
				this.#fps = (1000 / difference);
				this.dispatchEvent(new Event(`trigger`));
			} else {
				this.#fps = 0;
			}
			this.#previous = current;
		}
		requestAnimationFrame(this.#callback.bind(this));
	}
	/** @type {number} */
	#gap = 0;
	/**
	 * Gets the FPS limit of the engine.
	 * @returns {number}
	 */
	get limit() {
		return 1000 / this.#gap;
	}
	/**
	 * Sets the FPS limit of the engine.
	 * @param {number} value 
	 * @returns {void}
	 */
	set limit(value) {
		if (Number.isNaN(value)) return;
		if (value <= 0) return;
		this.#gap = 1000 / value;
	}
	/** @type {number} */
	#fps = 0;
	/**
	 * Gets the current FPS of the engine.
	 * @readonly
	 * @returns {number}
	 */
	get fps() {
		return this.#fps;
	}
	/**
	 * Gets the time delta between frames.
	 * @readonly
	 * @returns {number}
	 */
	get delta() {
		return 1 / this.#fps;
	}
}
//#endregion
//#region Precise engine
/**
 * @typedef {{ }} Extendable.PreciseEngineEventMap
 * 
 * @typedef {EngineEventMap & Extendable.PreciseEngineEventMap} PreciseEngineEventMap
 */

/**
 * Constructs a precise type engine.
 */
class PreciseEngine extends Engine {
	/**
	 * @param {boolean} launch Whether the engine should be launched initially. Default is false.
	 */
	constructor(launch = false) {
		super();

		this.#launched = launch;
		this.addEventListener(`trigger`, event => this.dispatchEvent(new Event(`start`)), { once: true });
		setTimeout(this.#callback.bind(this), this.#gap, performance.now());
	};
	/**
	 * @template {keyof PreciseEngineEventMap} K
	 * @overload
	 * @param {K} type 
	 * @param {(this: PreciseEngine, ev: PreciseEngineEventMap[K]) => any} listener 
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
	 * @template {keyof PreciseEngineEventMap} K
	 * @overload
	 * @param {K} type 
	 * @param {(this: PreciseEngine, ev: PreciseEngineEventMap[K]) => any} listener 
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
	#launched;
	/**
	 * Gets the launch status of the engine.
	 * @returns {boolean}
	 */
	get launched() {
		return this.#launched;
	}
	/**
	 * Sets the launch status of the engine.
	 * @param {boolean} value 
	 * @returns {void}
	 */
	set launched(value) {
		const previous = this.#launched;
		this.#launched = value;
		if (previous !== value) this.dispatchEvent(new Event(`change`));
		if (value) this.dispatchEvent(new Event(`launch`));
	}
	/** @type {number} */
	#previous = performance.now();
	/**
	 * @param {DOMHighResTimeStamp} current 
	 * @returns {void}
	 */
	#callback(current) {
		const difference = current - this.#previous;
		if (this.launched) {
			this.#fps = (1000 / difference);
			this.dispatchEvent(new Event(`trigger`));
		} else {
			this.#fps = 0;
		}
		this.#previous = current;
		setTimeout(this.#callback.bind(this), this.#gap, performance.now());
	}
	/** @type {number} */
	#gap = 0;
	/**
	 * Gets the FPS limit of the engine.
	 * @returns {number}
	 */
	get limit() {
		return 1000 / this.#gap;
	}
	/**
	 * Sets the FPS limit of the engine.
	 * @param {number} value 
	 * @returns {void}
	 */
	set limit(value) {
		if (Number.isNaN(value)) return;
		if (value <= 0) return;
		this.#gap = 1000 / value;
	}
	/** @type {number} */
	#fps = 0;
	/**
	 * Gets the current FPS of the engine.
	 * @readonly
	 * @returns {number}
	 */
	get fps() {
		return this.#fps;
	}
	/**
	 * Gets the time delta between frames.
	 * @readonly
	 * @returns {number}
	 */
	get delta() {
		return 1 / this.#fps;
	}
}
//#endregion
//#region Static engine
/**
 * @typedef {{ }} Extendable.StaticEngineEventMap
 * 
 * @typedef {EngineEventMap & Extendable.StaticEngineEventMap} StaticEngineEventMap
 */

/**
 * Constructs a static type engine.
 */
class StaticEngine extends Engine {
	/**
	 * @param {boolean} launch Whether the engine should be launched initially. Default is false.
	 */
	constructor(launch = false) {
		super();

		this.#launched = launch;
		this.addEventListener(`trigger`, event => this.dispatchEvent(new Event(`start`)), { once: true });
		setTimeout(this.#callback.bind(this));
	}
	/**
	 * @template {keyof StaticEngineEventMap} K
	 * @overload
	 * @param {K} type 
	 * @param {(this: StaticEngine, ev: StaticEngineEventMap[K]) => any} listener 
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
	 * @template {keyof StaticEngineEventMap} K
	 * @overload
	 * @param {K} type 
	 * @param {(this: StaticEngine, ev: StaticEngineEventMap[K]) => any} listener 
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
	#launched;
	/**
	 * Gets the launch status of the engine.
	 * @returns {boolean}
	 */
	get launched() {
		return this.#launched;
	}
	/**
	 * Sets the launch status of the engine.
	 * @param {boolean} value 
	 * @returns {void}
	 */
	set launched(value) {
		const previous = this.#launched;
		this.#launched = value;
		if (previous !== value) this.dispatchEvent(new Event(`change`));
		if (value) this.dispatchEvent(new Event(`launch`));
	}
	/** @type {number} */
	#previous = 0;
	/**
	 * @returns {void}
	 */
	#callback() {
		const current = performance.now();
		const difference = current - this.#previous;
		const count = trunc(difference / this.#gap);
		this.#delta = difference / count;
		for (let index = 0; index < count; index++) {
			if (this.launched) this.dispatchEvent(new Event(`trigger`));
			this.#previous = current;
		}
		setTimeout(this.#callback.bind(this));
	};
	/** @type {number} */
	#gap = 1000 / 120;
	/**
	 * Gets the FPS limit of the engine.
	 * @returns {number}
	 */
	get limit() {
		return 1000 / this.#gap;
	}
	/**
	 * Sets the FPS limit of the engine.
	 * @param {number} value 
	 * @returns {void}
	 */
	set limit(value) {
		if (Number.isNaN(value)) return;
		if (value <= 0) return;
		this.#gap = 1000 / value;
		this.#delta = this.#gap;
	}
	/** @type {number} */
	#delta = this.#gap;
	/**
	 * Gets the current FPS of the engine.
	 * @readonly
	 * @returns {number}
	 */
	get fps() {
		return 1000 / this.#delta;
	}
	/**
	 * Gets the time delta between frames.
	 * @readonly
	 * @returns {number}
	 */
	get delta() {
		return this.#delta / 1000;
	}
}
//#endregion

//#region Socket package
/**
 * @typedef {object} SocketPackageNotation
 * @property {string} type
 * @property {boolean} rejected
 * @property {object} details
 */

/**
 * Represents a structured data package for communication over sockets.
 */
class SocketPackage {
	/**
	 * Imports a SocketPackage from a given source object.
	 * @param {any} source The object to import as a SocketPackage.
	 * @param {string} name An optional name for the source, used in error messages.
	 * @returns {SocketPackage} A new instance of SocketPackage.
	 * @throws {TypeError} If the source cannot be imported as a SocketPackage.
	 */
	static import(source, name = `source`) {
		try {
			const shell = Object.import(source);
			const type = String.import(Reflect.get(shell, `type`), `property type`);
			const rejected = Boolean.import(Reflect.get(shell, `rejected`), `property rejected`);
			const details = Reflect.get(shell, `details`);
			return new SocketPackage(type, details, rejected);
		} catch (reason) {
			throw new TypeError(`Unable to import ${(name)} due its ${typename(source)} type`, { cause: reason });
		}
	}
	/**
	 * Exports the current SocketPackage instance as a plain object.
	 * @returns {SocketPackageNotation} The exported package notation.
	 */
	export() {
		return {
			type: this.#type.export(),
			rejected: this.#rejected.export(),
			details: this.#details
		};
	}
	/**
	 * @param {string} type The type of the package.
	 * @param {any} details The details or payload of the package.
	 * @param {boolean} rejected Whether the package is rejected.
	 */
	constructor(type, details = null, rejected = false) {
		this.#type = type;
		this.#details = details;
		this.#rejected = rejected;
	}
	/** @type {string} */
	#type;
	/**
	 * Gets the type of the package.
	 * @readonly
	 * @returns {string}
	 */
	get type() {
		return this.#type;
	}
	/** @type {boolean} */
	#rejected;
	/**
	 * Gets the rejection status of the package.
	 * @readonly
	 * @returns {boolean}
	 */
	get rejected() {
		return this.#rejected;
	}
	/** @type {any} */
	#details;
	/**
	 * Gets the details of the package.
	 * @readonly
	 * @returns {any}
	 */
	get details() {
		return this.#details;
	}
}
//#endregion
//#region Socket manager
/**
 * @typedef {object} SocketManagerEventMap
 * @property {Event} connect
 * @property {Event} disconnect
 */

/**
 * Manages WebSocket connections and provides methods for sending and receiving messages.
 * This class extends the `EventTarget` API to handle connection events.
 */
class SocketManager extends EventTarget {
	/**
	 * @param {string | URL} url The URL for the WebSocket connection.
	 */
	constructor(url) {
		super();

		this.#url = url;
		this.#connect(0);
	}
	/**
	 * @template {keyof SocketManagerEventMap} K
	 * @overload
	 * @param {K} type 
	 * @param {(this: SocketManager, ev: SocketManagerEventMap[K]) => any} listener 
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
	 * @template {keyof SocketManagerEventMap} K
	 * @overload
	 * @param {K} type 
	 * @param {(this: SocketManager, ev: SocketManagerEventMap[K]) => any} listener 
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
	/** @type {string | URL} */
	#url;
	/** @type {WebSocket?} */
	#socket = null;
	/**
	 * @param {number} attempt 
	 * @returns {Promise<void>}
	 */
	async #connect(attempt) {
		try {
			const socket = this.#socket = new WebSocket(this.#url);
			await Promise.withSignal((signal, resolve, reject) => {
				socket.addEventListener(`open`, (event) => resolve(undefined), { signal });
				socket.addEventListener(`error`, (event) => reject(Reflect.get(event, `error`)), { signal });
				socket.addEventListener(`close`, (event) => reject(event.reason), { signal });
			});
			this.dispatchEvent(new Event(`connect`));
		} catch (reason) {
			await this.#connect(attempt + 1);
		}
		this.#observe();
	}
	/**
	 * @returns {Promise<void>}
	 */
	async #observe() {
		const socket = this.#socket;
		if (socket === null) return;
		await Promise.withSignal((signal, resolve) => {
			socket.addEventListener(`error`, (event) => resolve(Reflect.get(event, `error`)), { signal });
			socket.addEventListener(`close`, (event) => resolve(event.reason), { signal });
		});
		this.dispatchEvent(new Event(`disconnect`));
		this.#connect(0);
	}
	/**
	 * Sends a message to the server and waits for a response.
	 * @param {string} type The type of the message.
	 * @param {any} details The payload of the message.
	 * @returns {Promise<object>} Resolves with the response details.
	 * @throws {Error} If the socket is not connected or an error occurs.
	 */
	async send(type, details = null) {
		const socket = this.#socket;
		if (socket === null || socket.readyState !== WebSocket.OPEN) throw new Error(`Socket is not connected.`);
		const promiseResponse = Promise.withSignal((signal, resolve, reject) => {
			socket.addEventListener(`message`, ({ data }) => {
				const response = SocketPackage.import(JSON.parse(data));
				if (response.type !== type) return;
				if (response.rejected) reject(response.details);
				resolve(response.details);
			}, { signal });
		});
		socket.send(JSON.stringify(new SocketPackage(type, details).export()));
		return await promiseResponse;
	}
}
//#endregion

export { Engine, FastEngine, PreciseEngine, StaticEngine, SocketManager };
