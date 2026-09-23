"use strict";

import "adaptive-extender/core";
import { type AudiosetView, type StageHost, type VisualizationBundle, type VisualizationEnvironment } from "../models/visualization.js";
import { type LayerSettings } from "../models/layer-settings.js";
import { type Layer } from "./layers.js";

//#region Stage
export class Stage implements StageHost {
	#name: string;
	#bundle: VisualizationBundle;
	#background: Layer;
	#lyrics: Layer;
	#layers: Layer[];
	#audioset: AudiosetView;
	#environment: VisualizationEnvironment;
	#camera: DOMMatrix = new DOMMatrix();
	#width: number = 0;
	#height: number = 0;
	#isBroken: boolean = false;

	constructor(name: string, bundle: VisualizationBundle, background: Layer, lyrics: Layer, audioset: AudiosetView, environment: VisualizationEnvironment) {
		this.#name = name;
		this.#bundle = bundle;
		this.#background = background;
		this.#lyrics = lyrics;
		this.#layers = Array.from(bundle.layers);
		this.#audioset = audioset;
		this.#environment = environment;
	}

	get width(): number { return this.#width; }
	get height(): number { return this.#height; }
	get camera(): DOMMatrix { return this.#camera; }
	get audioset(): AudiosetView { return this.#audioset; }
	get environment(): VisualizationEnvironment { return this.#environment; }

	#report(subject: string, reason: unknown): void {
		console.error(`${subject} of visualization '${this.#name}' failed and was disabled until the next rebuild:\n${Error.from(reason)}`);
	}

	#resetCamera(): void {
		const camera = this.#camera;
		camera.a = 1;
		camera.b = 0;
		camera.c = 0;
		camera.d = 1;
		camera.e = 0;
		camera.f = 0;
	}

	#update(): void {
		if (this.#isBroken) return;
		try {
			this.#bundle.update(this);
		} catch (reason) {
			this.#isBroken = true;
			this.#report("Update", reason);
		}
	}

	#draw(layer: Layer, output: OffscreenCanvasRenderingContext2D): void {
		if (!layer.isVisible) return;
		if (layer.isDependent && this.#isBroken) return;
		try {
			layer.render(this, output);
		} catch (reason) {
			layer.fault();
			this.#report(`Layer '${layer.name}'`, reason);
		}
	}

	arrange(settings: readonly LayerSettings[]): void {
		const layers = this.#layers;
		const ordered: Layer[] = [];
		for (const entry of settings) {
			const layer = layers.find(candidate => candidate.name === entry.name);
			if (layer === undefined) continue;
			if (ordered.includes(layer)) continue;
			layer.apply(entry);
			ordered.push(layer);
		}
		for (const layer of layers) if (!ordered.includes(layer)) ordered.push(layer);
		this.#layers = ordered;
	}

	rebuild(width: number, height: number): void {
		this.#width = width;
		this.#height = height;
		this.#isBroken = false;
		this.#resetCamera();
		this.#background.resize(width, height);
		this.#lyrics.resize(width, height);
		for (const layer of this.#layers) layer.resize(width, height);
		try {
			this.#bundle.rebuild(this);
		} catch (reason) {
			this.#isBroken = true;
			this.#report("Rebuild", reason);
		}
	}

	release(): void {
		for (const layer of this.#layers) layer.release();
	}

	render(output: OffscreenCanvasRenderingContext2D): void {
		this.#resetCamera();
		this.#update();
		output.reset();
		this.#draw(this.#background, output);
		for (const layer of this.#layers) this.#draw(layer, output);
		this.#draw(this.#lyrics, output);
	}
}
//#endregion
