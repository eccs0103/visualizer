"use strict";

import "adaptive-extender/core";
import { type StageHost, type VisualizationBundle, type VisualizationDescriptor } from "../models/visualization.js";
import { Layer } from "./layers.js";

//#region Registry
export class Registry {
	static #descriptors: Map<string, VisualizationDescriptor> = new Map();

	//#region Visualization
	static #Visualization: VisualizationDescriptor = class Visualization implements VisualizationBundle {
		constructor() {
			if (new.target === Visualization) throw new TypeError("Unable to create an instance of an abstract class");
			if (Registry.#lockDescriptor) throw new TypeError("Illegal constructor");
		}

		layers(): Layer[] {
			return [];
		}

		rebuild(stage: StageHost): void {
			void stage;
		}

		update(stage: StageHost): void {
			void stage;
		}
	};

	static get Visualization(): VisualizationDescriptor { return this.#Visualization; }

	static #lockDescriptor: boolean = true;
	static createBundle(descriptor: VisualizationDescriptor): VisualizationBundle {
		Registry.#lockDescriptor = false;
		try {
			return Reflect.construct(descriptor, []);
		} finally {
			Registry.#lockDescriptor = true;
		}
	}
	//#endregion

	static get default(): string {
		const key: IteratorResult<string, BuiltinIteratorReturn> = this.#descriptors.keys().next();
		if (key.done) throw new Error("No visualization is attached to the visualizer");
		return key.value;
	}

	static #assertLayers(layers: readonly Layer[]): void {
		if (!Array.isArray(layers)) throw new TypeError("layers() must return an array of layers");
		if (layers.length === 0) throw new TypeError("layers() returned no layers, see CONTRIBUTING.md");
		const names = new Set<string>();
		for (const layer of layers) {
			if (!(layer instanceof Layer)) throw new TypeError("layers() must return only Layer instances");
			if (names.has(layer.name)) throw new TypeError(`Layer name '${layer.name}' is used more than once`);
			names.add(layer.name);
		}
	}

	static attach(name: string, descriptor: VisualizationDescriptor): void {
		if (this.#descriptors.has(name)) {
			console.error(`Visualization '${name}' is already attached, the duplicate was ignored`);
			return;
		}
		try {
			this.#assertLayers(this.createBundle(descriptor).layers());
		} catch (reason) {
			console.error(`Visualization '${name}' was rejected:\n${Error.from(reason)}`);
			return;
		}
		this.#descriptors.set(name, descriptor);
	}

	static layers(name: string): Layer[] {
		const descriptor = ReferenceError.suppress(this.#descriptors.get(name), `Visualization with name '${name}' is not attached`);
		return this.createBundle(descriptor).layers();
	}

	static names(): IterableIterator<string> {
		return this.#descriptors.keys();
	}

	static has(name: string): boolean {
		return this.#descriptors.has(name);
	}

	static entries(): IterableIterator<[string, VisualizationDescriptor]> {
		return this.#descriptors.entries();
	}
}

export const Visualization: VisualizationDescriptor = Registry.Visualization;
//#endregion
