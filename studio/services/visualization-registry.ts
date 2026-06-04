"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";

//#region Visualization environment
export interface VisualizationEnvironment {
	get isLaunched(): boolean;
	get delta(): number;
	get fps(): number;
	get colorBackground(): Color;
}
//#endregion
//#region Audioset view
export interface AudiosetView {
	get length(): number;
	get volume(): number;
	get amplitude(): number;
	get dataFrequency(): Float32Array;
	get dataTemporal(): Float32Array;
}
//#endregion
//#region Visualization host
export interface VisualizationHost {
	context: OffscreenCanvasRenderingContext2D;
	audioset: AudiosetView;
	environment: VisualizationEnvironment;
}
//#endregion
//#region Visualization 
export interface VisualizationBundle {
	get context(): OffscreenCanvasRenderingContext2D;
	get audioset(): AudiosetView;
	get environment(): VisualizationEnvironment;
	rebuild(): void;
	update(): void;
}

export interface VisualizationDescriptor {
	new(host: VisualizationHost): VisualizationBundle;
}

export class Registry {
	static #descriptors: Map<string, VisualizationDescriptor> = new Map();

	//#region Visualization
	static #Visualization: VisualizationDescriptor = class Visualization implements VisualizationBundle {
		#host: VisualizationHost;

		constructor(host: VisualizationHost) {
			if (new.target === Visualization) throw new TypeError("Unable to create an instance of an abstract class");
			if (Registry.#lockDescriptor) throw new TypeError("Illegal constructor");
			this.#host = host;
		}

		get context(): OffscreenCanvasRenderingContext2D { return this.#host.context; }
		get audioset(): AudiosetView { return this.#host.audioset; }
		get environment(): VisualizationEnvironment { return this.#host.environment; }

		rebuild(): void {
		}

		update(): void {
		}
	};

	static get Visualization(): VisualizationDescriptor { return this.#Visualization; }

	static #lockDescriptor: boolean = true;
	static createBundle(host: VisualizationHost, descriptor: VisualizationDescriptor): VisualizationBundle {
		Registry.#lockDescriptor = false;
		const bundle: VisualizationBundle = Reflect.construct(descriptor, [host]);
		Registry.#lockDescriptor = true;
		return bundle;
	}
	//#endregion

	static attach(name: string, descriptor: VisualizationDescriptor): void {
		if (!this.#descriptors.add(name, descriptor)) throw new Error(`Visualization with name '${name}' already attached`);
	}

	static *entries(): IterableIterator<[string, VisualizationDescriptor]> {
		for (const entry of this.#descriptors) yield entry;
	}

	static names(): string[] {
		return Array.from(this.#descriptors, ([name]) => name);
	}
}

export const Visualization: VisualizationDescriptor = Registry.Visualization;
//#endregion
