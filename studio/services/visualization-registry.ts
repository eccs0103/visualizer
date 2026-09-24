"use strict";

import "adaptive-extender/core";
import { type StageHost, type VisualizationBundle, type VisualizationDescriptor } from "../models/visualization.js";
import { CodeLayer, type Layer, type LayerOptions, type LayerPainter } from "./layers.js";

//#region Registry
export class Registry {
	static #descriptors: Map<string, VisualizationDescriptor> = new Map();
	static #reserved: ReadonlySet<string> = new Set(["Background", "Lyrics"]);

	//#region Visualization
	static #Visualization: VisualizationDescriptor = class Visualization implements VisualizationBundle {
		#layers: Layer[] = [];

		constructor() {
			if (new.target === Visualization) throw new TypeError("Unable to create an instance of an abstract class");
			if (Registry.#lockDescriptor) throw new TypeError("Illegal constructor");
		}

		get layers(): readonly Layer[] { return this.#layers; }

		newCustomLayer(name: string, painter: LayerPainter, options: Partial<LayerOptions> = {}): Layer {
			if (Registry.#reserved.has(name)) throw new TypeError(`Layer name '${name}' is reserved by the engine`);
			if (this.#layers.some(layer => layer.name === name)) throw new TypeError(`Layer name '${name}' is used more than once`);
			const layer = new CodeLayer(name, painter, options);
			this.#layers.push(layer);
			return layer;
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

	static attach(name: string, descriptor: VisualizationDescriptor): void {
		if (this.#descriptors.has(name)) {
			console.error(`Visualization '${name}' is already attached, the duplicate was ignored`);
			return;
		}
		try {
			const bundle = this.createBundle(descriptor);
			if (bundle.layers.length === 0) throw new TypeError("The visualization declared no layers, see CONTRIBUTING.md");
		} catch (reason) {
			console.error(`Visualization '${name}' was rejected:
${Error.from(reason)}`);
			return;
		}
		this.#descriptors.set(name, descriptor);
	}

	static layers(name: string): readonly Layer[] {
		const descriptor = ReferenceError.suppress(this.#descriptors.get(name), `Visualization with name '${name}' is not attached`);
		return this.createBundle(descriptor).layers;
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

export const { Visualization } = Registry;
//#endregion
