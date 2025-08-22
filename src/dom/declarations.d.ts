/// <reference path="./extensions.js" />

interface ParentNode {
	/**
	 * Retrieves an element of the specified type and selectors.
	 * @template T
	 * @param type The type of element to retrieve.
	 * @param selectors The selectors to search for the element.
	 * @returns The element instance.
	 * @throws {TypeError} If the element is missing or has an invalid type.
	 */
	getElement<T extends typeof Element>(type: T, selectors: string): InstanceType<T>;
	/**
	 * Asynchronously retrieves an element of the specified type and selectors.
	 * @template T
	 * @param type The type of element to retrieve.
	 * @param selectors The selectors to search for the element.
	 * @returns The element instance.
	 * @throws {TypeError} If the element is missing or has an invalid type.
	 */
	getElementAsync<T extends typeof Element>(type: T, selectors: string): Promise<InstanceType<T>>;
	/**
	 * Retrieves elements of the specified type and selectors.
	 * @template T
	 * @param type The type of elements to retrieve.
	 * @param selectors The selectors to search for the elements.
	 * @returns The NodeList of element instances.
	 * @throws {TypeError} If any element is missing or has an invalid type.
	 */
	getElements<T extends typeof Element>(type: T, selectors: string): NodeListOf<InstanceType<T>>;
	/**
	 * Asynchronously retrieves elements of the specified type and selectors.
	 * @template T
	 * @param type The type of elements to retrieve.
	 * @param selectors The selectors to search for the elements.
	 * @returns The NodeList of element instances.
	 * @throws {TypeError} If any element is missing or has an invalid type.
	 */
	getElementsAsync<T extends typeof Element>(type: T, selectors: string): Promise<NodeListOf<InstanceType<T>>>;
}

interface Element {
	/**
	 * Retrieves the closest ancestor element of the specified type and selectors.
	 * @template T
	 * @param type The type of element to retrieve.
	 * @param selectors The selectors to search for the element.
	 * @returns The element instance.
	 * @throws {TypeError} If the element is missing or has an invalid type.
	 */
	getClosest<T extends typeof Element>(type: T, selectors: string): InstanceType<T>;
	/**
	 * Asynchronously retrieves the closest ancestor element of the specified type and selectors.
	 * @template T
	 * @param type The type of element to retrieve.
	 * @param selectors The selectors to search for the element.
	 * @returns The element instance.
	 * @throws {TypeError} If the element is missing or has an invalid type.
	 */
	getClosestAsync<T extends typeof Element>(type: T, selectors: string): Promise<InstanceType<T>>;
}

interface Document {
	/**
	 * Asynchronously loads an image from the specified URL.
	 * @param url The URL of the image to be loaded.
	 * @returns A promise that resolves with the loaded image element.
	 * @throws {Error} If the image fails to load.
	 */
	loadImage(url: string): Promise<HTMLImageElement>;
	/**
	 * Asynchronously loads multiple images from the provided URLs.
	 * @param urls An array of image URLs to be loaded.
	 * @returns A promise that resolves with an array of loaded image elements.
	 * @throws {Error} If any image fails to load.
	 */
	loadImages(urls: string[]): Promise<HTMLImageElement[]>;
}

interface Window {
	/**
	 * Asynchronously displays an alert message.
	 * @param message The message to display.
	 * @returns A promise that resolves when the alert is closed.
	 */
	alertAsync(message?: any): Promise<void>;
	/**
	 * Asynchronously displays a confirmation dialog.
	 * @param message The message to display.
	 * @returns A promise that resolves to true if the user confirms, and false otherwise.
	 */
	confirmAsync(message?: string): Promise<boolean>;
	/**
	 * Asynchronously displays a prompt dialog.
	 * @param message The message to display.
	 * @returns A promise that resolves to the user's input value if accepted, or null if canceled.
	 */
	promptAsync(message?: string, _default?: string): Promise<string?>;
	/**
	 * Asynchronously loads a promise with a loading animation.
	 * @template T
	 * @param promise The promise to load.
	 * @param delay The delay before the loading animation starts.
	 * @param duration The duration of the loading animation.
	 * @returns A promise that resolves to the result of the input promise.
	 */
	load<T>(promise: Promise<T>, delay?: number, duration?: number): Promise<T>;
}

/**
 * Asynchronously displays an alert message.
 * @param message The message to display.
 * @param title The title of the alert.
 * @returns A promise that resolves when the alert is closed.
 */
declare function alertAsync(message?: any): Promise<void>;
/**
 * Asynchronously displays a confirmation dialog.
 * @param message The message to display.
 * @param title The title of the confirmation dialog.
 * @returns A promise that resolves to true if the user confirms, and false otherwise.
 */
declare function confirmAsync(message?: string): Promise<boolean>;
/**
 * Asynchronously displays a prompt dialog.
 * @param message The message to display.
 * @param title The title of the prompt dialog.
 * @returns A promise that resolves to the user's input value if accepted, or null if canceled.
 */
declare function promptAsync(message?: string, _default?: string): Promise<string?>;
/**
 * Executes an action and handles any errors that occur.
 * @param action The action to be executed.
 * @param silent In silent mode errors are silently ignored; otherwise, they are thrown and the page is reloaded.
 * @returns A promise that resolves the action.
 */
declare function assert(action: VoidFunction, silent?: boolean): Promise<void>;
/**
 * Asynchronously loads a promise with a loading animation.
 * @template T
 * @param promise The promise to load.
 * @param duration The duration of the loading animation.
 * @param delay The delay before the loading animation starts.
 * @returns A promise that resolves to the result of the input promise.
 */
declare function load<T>(promise: Promise<T>, duration?: number, delay?: number): Promise<T>;

interface Navigator {
	/**
	 * Retrieves the data path based on developer and application name metadata.
	 * @returns The data path.
	 */
	readonly dataPath: string;
	/**
	 * Retrieves the version information from the metadata.
	 * @returns An instance representing the version.
	 */
	readonly version: VersionManager;
	/**
	 * А property to interact with the color scheme in webpage.
	 */
	colorScheme: string;
	/**
	 * Downloads the specified file.
	 * @param file The file to download.
	 */
	download(file: File): void;
}
