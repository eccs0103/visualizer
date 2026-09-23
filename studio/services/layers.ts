"use strict";

import "adaptive-extender/core";
import { Blend } from "../models/blend.js";
import { type StageHost, type VisualizationHost } from "../models/visualization.js";
import { type LayerSettings } from "../models/layer-settings.js";

//#region Layer
export interface LayerOptions {
	opacity: number;
	blend: Blend;
}

export abstract class Layer {
	#name: string;
	#opacity: number;
	#blend: Blend;
	#isFaulted: boolean = false;

	constructor(name: string, options: Partial<LayerOptions> = {}) {
		if (new.target === Layer) throw new TypeError("Unable to create an instance of an abstract class");
		if (name.length === 0) throw new TypeError("Layer name must not be empty");
		let { opacity, blend } = options;
		opacity ??= 1;
		blend ??= Blend.normal;
		if (!Object.values(Blend).includes(blend)) throw new TypeError(`Layer '${name}' has an unknown blend '${blend}'`);
		this.#name = name;
		this.#opacity = Layer.#fit(opacity);
		this.#blend = blend;
	}

	static #fit(opacity: number): number {
		if (!Number.isFinite(opacity)) throw new TypeError(`Layer opacity ${opacity} must be a finite number`);
		return opacity.clamp(0, 1);
	}

	get name(): string { return this.#name; }
	get opacity(): number { return this.#opacity; }
	get blend(): Blend { return this.#blend; }
	get isVisible(): boolean { return !this.#isFaulted && this.#opacity > 0; }
	get isDependent(): boolean { return false; }

	abstract render(stage: StageHost, output: OffscreenCanvasRenderingContext2D): void;

	apply(settings: LayerSettings): void {
		this.#opacity = Layer.#fit(settings.opacity);
		this.#blend = settings.blend;
	}

	fault(): void {
		this.#isFaulted = true;
	}

	resize(width: number, height: number): void {
		void width, height;
		this.#isFaulted = false;
	}

	release(): void { }
}
//#endregion
//#region Painted layer
export abstract class PaintedLayer extends Layer {
	#canvas: OffscreenCanvas | null = null;
	#context: OffscreenCanvasRenderingContext2D | null = null;
	#isDirty: boolean = false;

	abstract paint(host: VisualizationHost, stage: StageHost): void;

	isIdle(stage: StageHost): boolean {
		void stage;
		return false;
	}

	resize(width: number, height: number): void {
		super.resize(width, height);
		this.#isDirty = false;
		const canvas = this.#canvas;
		if (canvas !== null) {
			canvas.width = width;
			canvas.height = height;
			return;
		}
		const created = this.#canvas = new OffscreenCanvas(width, height);
		this.#context = ReferenceError.suppress(created.getContext("2d"), `Failed to acquire 2D rendering context for layer '${this.name}'`);
	}

	release(): void {
		const canvas = this.#canvas;
		if (canvas === null) return;
		canvas.width = 0;
		canvas.height = 0;
		this.#isDirty = false;
	}

	render(stage: StageHost, output: OffscreenCanvasRenderingContext2D): void {
		const context = ReferenceError.suppress(this.#context, `Layer '${this.name}' has not been sized`);
		if (this.isIdle(stage)) {
			if (!this.#isDirty) return;
			context.reset();
			this.#isDirty = false;
			return;
		}
		const canvas = ReferenceError.suppress(this.#canvas, `Layer '${this.name}' has not been sized`);
		const { width, height, camera, audioset, environment } = stage;
		context.reset();
		context.setTransform(1, 0, 0, 1, width / 2, height / 2);
		context.transform(camera.a, camera.b, camera.c, camera.d, camera.e, camera.f);
		this.#isDirty = true;
		this.paint({ context, audioset, environment }, stage);
		output.globalAlpha = this.opacity;
		output.globalCompositeOperation = this.blend as GlobalCompositeOperation;
		output.drawImage(canvas, 0, 0);
	}
}
//#endregion
//#region Code layer
export type LayerPainter = (host: VisualizationHost) => void;

export class CodeLayer extends PaintedLayer {
	#painter: LayerPainter;

	constructor(name: string, painter: LayerPainter, options: Partial<LayerOptions> = {}) {
		super(name, options);
		this.#painter = painter;
	}

	get isDependent(): boolean { return true; }

	paint(host: VisualizationHost): void {
		this.#painter(host);
	}
}
//#endregion
