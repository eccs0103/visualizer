/// <reference path="./declarations.d.ts" />

"use strict";

import { } from "../workers/extensions.js";
import { bSubtitle, dialogLoader } from "./loader.js";
import { buttonConfirmAccept, buttonConfirmDecline, buttonPromptAccept, dialogAlert, dialogConfirm, dialogPrompt, divAlertCoontainer, divConfirmContainer, divPromptContainer, inputPrompt } from "./popup.js";

//#region Parent node
/**
 * Retrieves an element of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of element to retrieve.
 * @param {string} selectors The selectors to search for the element.
 * @returns {InstanceType<T>} The element instance.
 * @throws {TypeError} If the element is missing or has an invalid type.
 */
Element.prototype.getElement = function (type, selectors) {
	const element = this.querySelector(selectors);
	if (element instanceof type) return (/** @type {InstanceType<T>} */ (element));
	else throw new TypeError(`Element ${selectors} is missing or has invalid type`);
};

/**
 * Asynchronously retrieves an element of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of element to retrieve.
 * @param {string} selectors The selectors to search for the element.
 * @returns {Promise<InstanceType<T>>} The element instance.
 * @throws {TypeError} If the element is missing or has an invalid type.
 */
Element.prototype.getElementAsync = function (type, selectors) {
	return Promise.resolve(this.getElement(type, selectors));
};

/**
 * Retrieves elements of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of elements to retrieve.
 * @param {string} selectors The selectors to search for the elements.
 * @returns {NodeListOf<InstanceType<T>>} The NodeList of element instances.
 * @throws {TypeError} If any element is missing or has an invalid type.
 */
Element.prototype.getElements = function (type, selectors) {
	const elements = this.querySelectorAll(selectors);
	if (Array.from(elements).every(element => element instanceof type)) return (/** @type {NodeListOf<InstanceType<T>>} */ (elements));
	else throw new TypeError(`Element ${selectors} is missing or has invalid type`);
};

/**
 * Asynchronously retrieves elements of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of elements to retrieve.
 * @param {string} selectors The selectors to search for the elements.
 * @returns {Promise<NodeListOf<InstanceType<T>>>} The NodeList of element instances.
 * @throws {TypeError} If any element is missing or has an invalid type.
 */
Element.prototype.getElementsAsync = function (type, selectors) {
	return Promise.resolve(this.getElements(type, selectors));
};

/**
 * Retrieves an element of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of element to retrieve.
 * @param {string} selectors The selectors to search for the element.
 * @returns {InstanceType<T>} The element instance.
 * @throws {TypeError} If the element is missing or has an invalid type.
 */
Document.prototype.getElement = function (type, selectors) {
	return this.documentElement.getElement(type, selectors);
};

/**
 * Asynchronously retrieves an element of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of element to retrieve.
 * @param {string} selectors The selectors to search for the element.
 * @returns {Promise<InstanceType<T>>} The element instance.
 * @throws {TypeError} If the element is missing or has an invalid type.
 */
Document.prototype.getElementAsync = function (type, selectors) {
	return this.documentElement.getElementAsync(type, selectors);
};

/**
 * Retrieves elements of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of elements to retrieve.
 * @param {string} selectors The selectors to search for the elements.
 * @returns {NodeListOf<InstanceType<T>>} The NodeList of element instances.
 * @throws {TypeError} If any element is missing or has an invalid type.
 */
Document.prototype.getElements = function (type, selectors) {
	return this.documentElement.getElements(type, selectors);
};

/**
 * Asynchronously retrieves elements of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of elements to retrieve.
 * @param {string} selectors The selectors to search for the elements.
 * @returns {Promise<NodeListOf<InstanceType<T>>>} The NodeList of element instances.
 * @throws {TypeError} If any element is missing or has an invalid type.
 */
Document.prototype.getElementsAsync = function (type, selectors) {
	return this.documentElement.getElementsAsync(type, selectors);
};

/**
 * Retrieves an element of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of element to retrieve.
 * @param {string} selectors The selectors to search for the element.
 * @returns {InstanceType<T>} The element instance.
 * @throws {TypeError} If the element is missing or has an invalid type.
 */
DocumentFragment.prototype.getElement = function (type, selectors) {
	const element = this.querySelector(selectors);
	if (element instanceof type) return (/** @type {InstanceType<T>} */ (element));
	else throw new TypeError(`Element ${selectors} is missing or has invalid type`);
};

/**
 * Asynchronously retrieves an element of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of element to retrieve.
 * @param {string} selectors The selectors to search for the element.
 * @returns {Promise<InstanceType<T>>} The element instance.
 * @throws {TypeError} If the element is missing or has an invalid type.
 */
DocumentFragment.prototype.getElementAsync = function (type, selectors) {
	return Promise.resolve(this.getElement(type, selectors));
};

/**
 * Retrieves elements of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of elements to retrieve.
 * @param {string} selectors The selectors to search for the elements.
 * @returns {NodeListOf<InstanceType<T>>} The NodeList of element instances.
 * @throws {TypeError} If any element is missing or has an invalid type.
 */
DocumentFragment.prototype.getElements = function (type, selectors) {
	const elements = this.querySelectorAll(selectors);
	if (Array.from(elements).every(element => element instanceof type)) return (/** @type {NodeListOf<InstanceType<T>>} */ (elements));
	else throw new TypeError(`Element ${selectors} is missing or has invalid type`);
};

/**
 * Asynchronously retrieves elements of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of elements to retrieve.
 * @param {string} selectors The selectors to search for the elements.
 * @returns {Promise<NodeListOf<InstanceType<T>>>} The NodeList of element instances.
 * @throws {TypeError} If any element is missing or has an invalid type.
 */
DocumentFragment.prototype.getElementsAsync = function (type, selectors) {
	return Promise.resolve(this.getElements(type, selectors));
};
//#endregion
//#region Element
/**
 * Retrieves the closest ancestor element of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of element to retrieve.
 * @param {string} selectors The selectors to search for the element.
 * @returns {InstanceType<T>} The element instance.
 * @throws {TypeError} If the element is missing or has an invalid type.
 */
Element.prototype.getClosest = function (type, selectors) {
	const element = this.closest(selectors);
	if (element instanceof type) return (/** @type {InstanceType<T>} */ (element));
	else throw new TypeError(`Element ${selectors} is missing or has invalid type`);
};

/**
 * Asynchronously retrieves the closest ancestor element of the specified type and selectors.
 * @template {typeof Element} T
 * @param {T} type The type of element to retrieve.
 * @param {string} selectors The selectors to search for the element.
 * @returns {Promise<InstanceType<T>>} The element instance.
 * @throws {TypeError} If the element is missing or has an invalid type.
 */
Element.prototype.getClosestAsync = function (type, selectors) {
	return Promise.resolve(this.getClosest(type, selectors));
};
//#endregion
//#region Document
/**
 * Asynchronously loads an image from the specified URL.
 * @param {string} url The URL of the image to be loaded.
 * @returns {Promise<HTMLImageElement>} A promise that resolves with the loaded image element.
 * @throws {Error} If the image fails to load.
 */
Document.prototype.loadImage = async function (url) {
	const image = new Image();
	const promise = Promise.withSignal((signal, resolve, reject) => {
		image.addEventListener(`load`, (event) => resolve(undefined), { signal });
		image.addEventListener(`error`, (event) => reject(Error.from(event.error)), { signal });
	});
	image.src = url;
	await promise;
	return image;
};

/**
 * Asynchronously loads multiple images from the provided URLs.
 * @param {string[]} urls An array of image URLs to be loaded.
 * @returns {Promise<HTMLImageElement[]>} A promise that resolves with an array of loaded image elements.
 * @throws {Error} If any image fails to load.
 */
Document.prototype.loadImages = async function (urls) {
	return await Promise.all(urls.map(url => this.loadImage(url)));
};
//#endregion
//#region Window
let isAlertComposed = false;
dialogAlert.addEventListener(`click`, (event) => {
	if (event.target !== dialogAlert) return;
	isAlertComposed = true;
	dialogAlert.close();
});
/**
 * Asynchronously displays an alert message.
 * @param {any} message The message to display.
 * @returns {Promise<void>} A promise that resolves when the alert is closed.
 */
Window.prototype.alertAsync = async function (message = String.empty) {
	dialogAlert.showModal();
	divAlertCoontainer.innerText = String(message);
	try {
		return await Promise.withSignal((signal, resolve) => {
			dialogAlert.addEventListener(`close`, event => (isAlertComposed ? resolve() : null), { signal });
		});
	} finally {
		isAlertComposed = false;
		dialogAlert.close();
	}
};

let isConfirmComposed = false;
dialogConfirm.addEventListener(`click`, (event) => {
	if (event.target !== dialogConfirm) return;
	isConfirmComposed = true;
	dialogConfirm.close();
});
/**
 * Asynchronously displays a confirmation dialog.
 * @param {string} message The message to display.
 * @returns {Promise<boolean>} A promise that resolves to true if the user confirms, and false otherwise.
 */
Window.prototype.confirmAsync = async function (message = String.empty) {
	dialogConfirm.showModal();
	divConfirmContainer.innerText = message;
	try {
		return await Promise.withSignal((signal, resolve) => {
			buttonConfirmAccept.addEventListener(`click`, event => resolve(true), { signal });
			buttonConfirmDecline.addEventListener(`click`, event => resolve(false), { signal });
			dialogConfirm.addEventListener(`close`, event => (isConfirmComposed ? resolve(false) : null), { signal });
		});
	} finally {
		isConfirmComposed = false;
		dialogConfirm.close();
	}
};

let isPromptComposed = false;
dialogPrompt.addEventListener(`click`, (event) => {
	if (event.target !== dialogPrompt) return;
	isPromptComposed = true;
	dialogPrompt.close();
});
/**
 * Asynchronously displays a prompt dialog.
 * @param {string} message The message to display.
 * @returns {Promise<string?>} A promise that resolves to the user's input value if accepted, or null if canceled.
 */
Window.prototype.promptAsync = async function (message = String.empty, _default = String.empty) {
	dialogPrompt.showModal();
	divPromptContainer.innerText = message;
	inputPrompt.value = _default;
	try {
		return await Promise.withSignal((signal, resolve) => {
			buttonPromptAccept.addEventListener(`click`, event => resolve(inputPrompt.value), { signal });
			dialogPrompt.addEventListener(`close`, event => (isPromptComposed ? resolve(null) : null), { signal });
		});
	} finally {
		isPromptComposed = false;
		dialogPrompt.close();
	}
};

void async function () {
	const subtitle = bSubtitle.innerText;
	const period = 4;
	let counter = 0;
	while (true) {
		await Promise.withTimeout(1000 / period);
		if (!dialogLoader.open) continue;
		bSubtitle.innerText = `${subtitle}${`.`.repeat(counter)}`;
		counter = (counter + 1) % period;
	}
}();

/** @type {Keyframe} */
const keyframeAppear = { opacity: `1` };
/** @type {Keyframe} */
const keyframeDisappear = { opacity: `0` };

/**
 * Asynchronously loads a promise with a loading animation.
 * @template T
 * @param {Promise<T>} promise The promise to load.
 * @param {number} duration The duration of the loading animation.
 * @param {number} delay The delay before the loading animation starts.
 * @returns {Promise<T>} A promise that resolves to the result of the input promise.
 */
Window.prototype.load = async function (promise, duration = 200, delay = 0) {
	try {
		dialogLoader.showModal();
		await dialogLoader.animate([keyframeDisappear, keyframeAppear], { duration, fill: `both` }).finished;
		return await promise;
	} finally {
		await dialogLoader.animate([keyframeAppear, keyframeDisappear], { duration, fill: `both`, delay }).finished;
		dialogLoader.close();
	}
};
//#endregion
//#region Version manager
/**
 * Represents a version manager for parsing and comparing version numbers.
 */
class VersionManager {
	/** @type {RegExp} */
	static #patternVersion = /^(\d+)\.(\d+)\.(\d+)$/;
	/**
	 * Parses a version number from the given string.
	 * @param {string} string The string representing the version number.
	 * @returns {VersionManager} A VersionManager instance representing the parsed version.
	 * @throws {SyntaxError} If the version syntax is invalid.
	 */
	static parse(string) {
		const match = VersionManager.#patternVersion.exec(string);
		if (match === null) throw new SyntaxError(`Invalid version '${string}' syntax. Version must have <number>.<number>.<number> syntax`);
		const [, major, minor, patch] = match.map(part => Number(part));
		const version = new VersionManager();
		version.#major = major;
		version.#minor = minor;
		version.#patch = patch;
		return version;
	}
	/** @type {number} */
	#major = 1;
	/** @type {number} */
	#minor = 0;
	/** @type {number} */
	#patch = 0;
	/**
	 * Checks if this version is higher than the specified version.
	 * @param {VersionManager} other The other version to compare against.
	 * @returns {boolean} True if this version is higher; otherwise, false.
	 */
	isHigherThen(other) {
		if (this.#major > other.#major) return true;
		else if (this.#minor > other.#minor) return true;
		else if (this.#patch > other.#patch) return true;
		else return false;
	}
	/**
	 * Converts the version to a string representation.
	 * @returns {string} The string representation of the version.
	 */
	toString() {
		return `${this.#major}.${this.#minor}.${this.#patch}`;
	}
}
//#endregion
//#region Navigator
Object.defineProperty(Navigator.prototype, `dataPath`, {
	/**
	 * @this {Navigator}
	 * @returns {string}
	 */
	get() {
		const developer = document.getElement(HTMLMetaElement, `meta[name="author"]`).content;
		const title = document.getElement(HTMLMetaElement, `meta[name="title"]`).content;
		return `${developer}.${title}`;
	}
});

Object.defineProperty(Navigator.prototype, `version`, {
	/**
	 * @this {Navigator}
	 * @returns {VersionManager}
	 */
	get() {
		const metaVersion = document.getElement(HTMLMetaElement, `meta[name="generator"]`).content;
		return VersionManager.parse(metaVersion);
	}
});

Object.defineProperty(Navigator.prototype, `colorScheme`, {
	/**
	 * @this {Navigator}
	 * @returns {string}
	 */
	get() {
		return document.getElement(HTMLMetaElement, `meta[name="color-scheme"]`).content;
	},
	/**
	 * @this {Navigator}
	 * @param {string} value 
	 * @returns {void}
	 */
	set(value) {
		document.getElement(HTMLMetaElement, `meta[name="color-scheme"]`).content = String(value);
	}
});

/**
 * Downloads the specified file.
 * @param {File} file The file to download.
 * @returns {void}
 */
Navigator.prototype.download = function (file) {
	const aLink = document.createElement(`a`);
	aLink.download = file.name;
	aLink.href = URL.createObjectURL(file);
	aLink.click();
	URL.revokeObjectURL(aLink.href);
	aLink.remove();
};
//#endregion

export { };
