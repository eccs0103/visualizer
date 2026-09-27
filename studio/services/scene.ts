"use strict";

import "adaptive-extender/core";
import { type LayerSettings } from "../models/layer-settings.js";
import { type BackgroundSettings } from "../models/background-settings.js";
import { type Layer } from "./layers.js";
import { type Stage } from "./stage.js";
import { type Host } from "../models/visualization.js";
import { Visualization } from "./visualization-registry.js";
import { BackgroundLayer, LyricsLayer } from "./engine-layers.js";

//#region Scene
export class Scene {
	#name: string;
	#visualization: Visualization;
	#stage: Stage;
	#host: Host;
	#background: BackgroundLayer = new BackgroundLayer();
	#lyrics: LyricsLayer = new LyricsLayer();
	#layers: Layer[];
	#isBroken: boolean = false;

	constructor(name: string, visualization: Visualization, stage: Stage, output: OffscreenCanvasRenderingContext2D) {
		this.#name = name;
		this.#visualization = visualization;
		this.#stage = stage;
		this.#host = { context: output, audioset: stage, environment: stage };
		this.#layers = Array.from(Visualization.layers(visualization));
	}

	#report(subject: string, reason: unknown): void {
		console.error(`${subject} of visualization '${this.#name}' failed and was disabled until the next rebuild:\n${Error.from(reason)}`);
	}

	#update(): void {
		if (this.#isBroken) return;
		try {
			this.#visualization.update(this.#host);
		} catch (reason) {
			this.#isBroken = true;
			this.#report("Update", reason);
		}
	}

	#draw(layer: Layer, output: OffscreenCanvasRenderingContext2D): void {
		if (!layer.isVisible) return;
		if (layer.isDependent && this.#isBroken) return;
		try {
			layer.render(this.#stage, output);
		} catch (reason) {
			layer.fault();
			this.#report(`Layer '${layer.name}'`, reason);
		}
	}

	arrange(settings: readonly LayerSettings[], background: BackgroundSettings, lyrics: LayerSettings): void {
		this.#background.apply(background);
		this.#lyrics.apply(lyrics);
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

	async setBackground(image: Blob | null): Promise<void> {
		await this.#background.setImage(image);
	}

	rebuild(): void {
		const stage = this.#stage;
		this.#isBroken = false;
		this.#background.resize(stage);
		this.#lyrics.resize(stage);
		for (const layer of this.#layers) layer.resize(stage);
		try {
			this.#visualization.rebuild(this.#host);
		} catch (reason) {
			this.#isBroken = true;
			this.#report("Rebuild", reason);
		}
	}

	release(): void {
		this.#background.release();
		this.#lyrics.release();
		for (const layer of this.#layers) layer.release();
	}

	render(): void {
		const output = this.#host.context;
		output.resetTransform();
		this.#update();
		this.#stage.updateCamera(output.getTransform());
		output.reset();
		this.#draw(this.#background, output);
		for (const layer of this.#layers) this.#draw(layer, output);
		this.#draw(this.#lyrics, output);
	}
}
//#endregion
