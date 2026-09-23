"use strict";

import "adaptive-extender/core";
import { Blend } from "../models/blend.js";
import { type StageHost, type VisualizationHost } from "../models/visualization.js";
import { type LayerSettings } from "../models/layer-settings.js";

const { min } = Math;

//#region Layer
export interface LayerOptions {
	opacity: number;
	blend: Blend;
}

export abstract class Layer {
	#name: string;
	#opacity: number;
	#blend: Blend;
	#canvas: OffscreenCanvas | null = null;
	#context: OffscreenCanvasRenderingContext2D | null = null;
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

	abstract paint(host: VisualizationHost, stage: StageHost): void;

	apply(settings: LayerSettings): void {
		this.#opacity = Layer.#fit(settings.opacity);
		this.#blend = settings.blend;
	}

	fault(): void {
		this.#isFaulted = true;
	}

	resize(width: number, height: number): void {
		this.#isFaulted = false;
		const canvas = this.#canvas;
		if (canvas !== null) {
			canvas.width = width;
			canvas.height = height;
			return;
		}
		const created = this.#canvas = new OffscreenCanvas(width, height);
		this.#context = ReferenceError.suppress(created.getContext("2d"), `Failed to acquire 2D rendering context for layer '${this.#name}'`);
	}

	render(stage: StageHost): void {
		const context = ReferenceError.suppress(this.#context, `Layer '${this.#name}' has not been sized`);
		const { width, height, camera, audioset, environment } = stage;
		context.reset();
		context.setTransform(new DOMMatrix().translateSelf(width / 2, height / 2).multiplySelf(camera));
		this.paint({ context, audioset, environment }, stage);
	}

	composite(output: OffscreenCanvasRenderingContext2D): void {
		const canvas = ReferenceError.suppress(this.#canvas, `Layer '${this.#name}' has not been sized`);
		output.globalAlpha = this.#opacity;
		output.globalCompositeOperation = this.#blend as GlobalCompositeOperation;
		output.drawImage(canvas, 0, 0);
	}
}
//#endregion
//#region Code layer
export type LayerPainter = (host: VisualizationHost) => void;

export class CodeLayer extends Layer {
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
//#region Background layer
export class BackgroundLayer extends Layer {
	paint(host: VisualizationHost): void {
		const { context, environment } = host;
		const { width, height } = context.canvas;
		context.resetTransform();
		context.fillStyle = environment.colorBackground.toString();
		context.fillRect(0, 0, width, height);
	}
}
//#endregion
//#region Lyrics layer
export class LyricsLayer extends Layer {
	paint(host: VisualizationHost, stage: StageHost): void {
		const { context, environment } = host;
		const { lyrics } = environment;
		if (lyrics === null) return;
		const { previous, current, next, shake } = lyrics;
		const { width, height, camera } = stage;

		const side = min(width, height);
		const sizeCurrent = side * 0.045;
		const sizeSide = side * 0.03;
		const y = height * 0.3;
		const maxWidth = width * 0.9;

		context.setTransform(
			1 + (camera.a - 1) * shake,
			camera.b * shake,
			camera.c * shake,
			1 + (camera.d - 1) * shake,
			width / 2 + camera.e * shake,
			height / 2 + camera.f * shake
		);
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.shadowColor = "black";
		context.shadowBlur = sizeCurrent * 0.3;

		context.font = `${sizeSide}px sans-serif`;
		context.fillStyle = "rgba(255, 255, 255, 0.6)";
		if (previous !== null) context.fillText(previous, 0, y - sizeCurrent, maxWidth);
		if (next !== null) context.fillText(next, 0, y + sizeCurrent, maxWidth);

		context.font = `bold ${sizeCurrent}px sans-serif`;
		context.fillStyle = "white";
		if (current !== null) context.fillText(current, 0, y, maxWidth);
	}
}
//#endregion
