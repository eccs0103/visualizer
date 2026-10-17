"use strict";

import "adaptive-extender/worker";
import { CodeLayer, type Layer, type LayerOptions, type LayerPainter } from "./layers.js";
import { type Host } from "../models/visualization.js";

//#region Visualization
export class Visualization {
	static #reserved: ReadonlySet<string> = new Set(["Background", "Lyrics"]);
	#layers: Layer[] = [];

	constructor() {
		if (new.target === Visualization) throw new TypeError("Unable to create an instance of an abstract class");
	}

	static layers(visualization: Visualization): readonly Layer[] {
		return visualization.#layers;
	}

	newLayer(name: string, painter: LayerPainter, options: Partial<LayerOptions> = {}): void {
		const layers = this.#layers;
		if (Visualization.#reserved.has(name)) throw new TypeError(`Layer name '${name}' is reserved by the engine`);
		if (layers.some(layer => layer.name === name)) throw new TypeError(`Layer name '${name}' is used more than once`);
		layers.push(new CodeLayer(name, painter, options));
	}

	rebuild(host: Host): void {
		void host;
	}

	update(host: Host): void {
		void host;
	}
}
//#endregion
//#region Registry
export class Registry {
	static #descriptors: Map<string, typeof Visualization> = new Map();

	static create(descriptor: typeof Visualization): Visualization {
		return new descriptor();
	}

	static get default(): string {
		const key: IteratorResult<string, BuiltinIteratorReturn> = this.#descriptors.keys().next();
		if (key.done) throw new ReferenceError("No visualization is attached to the visualizer");
		return key.value;
	}

	static attach(name: string, descriptor: typeof Visualization): void {
		const descriptors = this.#descriptors;
		if (descriptors.has(name)) {
			console.error(`Visualization '${name}' is already attached, the duplicate was ignored`);
			return;
		}
		try {
			const visualization = this.create(descriptor);
			if (Visualization.layers(visualization).length === 0) throw new TypeError("The visualization declared no layers, see CONTRIBUTING.md");
		} catch (reason) {
			console.error(`Visualization '${name}' was rejected:\n${Error.from(reason)}`);
			return;
		}
		descriptors.set(name, descriptor);
	}

	static layers(name: string): readonly Layer[] {
		const descriptor = ReferenceError.suppress(this.#descriptors.get(name), `Visualization with name '${name}' is not attached`);
		return Visualization.layers(this.create(descriptor));
	}

	static names(): IterableIterator<string> {
		return this.#descriptors.keys();
	}

	static has(name: string): boolean {
		return this.#descriptors.has(name);
	}

	static entries(): IterableIterator<[string, typeof Visualization]> {
		return this.#descriptors.entries();
	}
}
//#endregion
