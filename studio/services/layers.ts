"use strict";

import "adaptive-extender/core";
import { Blend } from "../models/blend.js";
import { type Stage } from "./stage.js";
import { type Host } from "../models/visualization.js";
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
		const { opacity = 1, blend = Blend.normal } = options;
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

	abstract render(stage: Stage, output: OffscreenCanvasRenderingContext2D): void;

	apply(settings: LayerSettings): void {
		this.#opacity = Layer.#fit(settings.opacity);
		this.#blend = settings.blend;
	}

	fault(): void {
		this.#isFaulted = true;
	}

	resize(stage: Stage): void {
		void stage;
		this.#isFaulted = false;
	}

	release(): void { }
}
//#endregion
//#region Painted layer
export abstract class PaintedLayer extends Layer {
	#host: Host | null = null;
	#isDirty: boolean = false;

	abstract paint(host: Host, stage: Stage): void;

	isIdle(stage: Stage): boolean {
		void stage;
		return false;
	}

	resize(stage: Stage): void {
		super.resize(stage);
		this.#isDirty = false;
		const { width, height } = stage;
		const host = this.#host;
		if (host !== null) {
			const { canvas } = host.context;
			canvas.width = width;
			canvas.height = height;
			return;
		}
		const canvas = new OffscreenCanvas(width, height);
		const context = ReferenceError.suppress(canvas.getContext("2d"), `Failed to acquire 2D rendering context for layer '${this.name}'`);
		this.#host = { context, audioset: stage, environment: stage };
	}

	release(): void {
		const host = this.#host;
		if (host === null) return;
		const { canvas } = host.context;
		canvas.width = 0;
		canvas.height = 0;
		this.#isDirty = false;
	}

	render(stage: Stage, output: OffscreenCanvasRenderingContext2D): void {
		const host = ReferenceError.suppress(this.#host, `Layer '${this.name}' has not been sized`);
		const { context } = host;
		if (this.isIdle(stage)) {
			if (!this.#isDirty) return;
			context.reset();
			this.#isDirty = false;
			return;
		}
		const { width, height, camera } = stage;
		context.reset();
		context.setTransform(1, 0, 0, 1, width / 2, height / 2);
		context.transform(camera.a, camera.b, camera.c, camera.d, camera.e, camera.f);
		this.#isDirty = true;
		this.paint(host, stage);
		output.globalAlpha = this.opacity;
		output.globalCompositeOperation = this.blend as GlobalCompositeOperation;
		output.drawImage(context.canvas, 0, 0);
	}
}
//#endregion
//#region Code layer
export interface LayerPainter {
	(host: Host): void;
}

export class CodeLayer extends PaintedLayer {
	#painter: LayerPainter;

	constructor(name: string, painter: LayerPainter, options: Partial<LayerOptions> = {}) {
		super(name, options);
		this.#painter = painter;
	}

	get isDependent(): boolean { return true; }

	paint(host: Host): void {
		this.#painter(host);
	}
}
//#endregion
