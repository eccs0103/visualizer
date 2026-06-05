"use strict";

import "adaptive-extender/core";
import { type VisualizationBundle, type VisualizationDescriptor, type VisualizationHost } from "../models/visualization.js";

//#region Registry
export class Registry {
	static #descriptors: Map<string, VisualizationDescriptor> = new Map();

	//#region Visualization
	static #Visualization: VisualizationDescriptor = class Visualization implements VisualizationBundle {
		constructor() {
			if (new.target === Visualization) throw new TypeError("Unable to create an instance of an abstract class");
			if (Registry.#lockDescriptor) throw new TypeError("Illegal constructor");
		}

		rebuild(host: VisualizationHost): void {
			void host;
		}

		update(host: VisualizationHost): void {
			void host;
		}
	};

	static get Visualization(): VisualizationDescriptor { return this.#Visualization; }

	static #lockDescriptor: boolean = true;
	static createBundle(descriptor: VisualizationDescriptor): VisualizationBundle {
		Registry.#lockDescriptor = false;
		const bundle: VisualizationBundle = Reflect.construct(descriptor, []);
		Registry.#lockDescriptor = true;
		return bundle;
	}
	//#endregion

	static get default(): string {
		const key: IteratorResult<string, BuiltinIteratorReturn> = this.#descriptors.keys().next();
		if (key.done) throw new Error("No visualization is attached to the visualizer");
		return key.value;
	}

	static attach(name: string, descriptor: VisualizationDescriptor): void {
		if (!this.#descriptors.add(name, descriptor)) throw new Error(`Visualization with name '${name}' already attached`);
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
