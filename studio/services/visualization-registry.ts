"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";

//#region Visualization registry
export interface VisualizationEnvironment {
	get isLaunched(): boolean;
	get delta(): number;
	get fps(): number;
	get colorBackground(): Color;
}

export interface AudiosetView {
	get length(): number;
	get volume(): number;
	get amplitude(): number;
	get dataFrequency(): Float32Array;
	get dataTemporal(): Float32Array;
}

export interface VisualizationBundle {
	get context(): OffscreenCanvasRenderingContext2D;
	get audioset(): AudiosetView;
	get environment(): VisualizationEnvironment;
	rebuild(): void;
	update(): void;
}

export interface VisualizationDescriptor {
	new(): VisualizationBundle;
}

export interface VisualizationHost {
	context: OffscreenCanvasRenderingContext2D;
	audioset: AudiosetView;
	environment: VisualizationEnvironment;
}

export class VisualizationRegistry {
	static #currentHost: VisualizationHost | null = null;
	static #descriptors: Map<string, VisualizationDescriptor> = new Map();

	static Visualization: VisualizationDescriptor = class Visualization implements VisualizationBundle {
		#host: VisualizationHost;

		constructor() {
			if (new.target === Visualization) throw new TypeError("Unable to create an instance of an abstract class");
			if (VisualizationRegistry.#currentHost === null) throw new TypeError("Illegal constructor");
			this.#host = VisualizationRegistry.#currentHost;
		}

		get context(): OffscreenCanvasRenderingContext2D { return this.#host.context; }
		get audioset(): AudiosetView { return this.#host.audioset; }
		get environment(): VisualizationEnvironment { return this.#host.environment; }

		rebuild(): void {
		}

		update(): void {
		}
	};

	static attach(name: string, descriptor: VisualizationDescriptor): void {
		if (this.#descriptors.add(name, descriptor)) throw new Error(`Visualization with name '${name}' already attached`);
	}

	static createBundle(host: VisualizationHost, descriptor: VisualizationDescriptor): VisualizationBundle {
		VisualizationRegistry.#currentHost = host;
		const bundle = Reflect.construct(descriptor, []);
		VisualizationRegistry.#currentHost = null;
		return bundle;
	}

	static entries(): IterableIterator<[string, VisualizationDescriptor]> {
		return this.#descriptors.entries();
	}

	static names(): string[] {
		return Array.from(this.#descriptors, ([name]) => name);
	}
}

export const Visualization: VisualizationDescriptor = VisualizationRegistry.Visualization;
//#endregion
