"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { BackgroundEffectKind, BackgroundFit, BackgroundSettings } from "../models/background-settings.js";
import { type StageHost, type VisualizationHost } from "../models/visualization.js";
import { type LayerSettings } from "../models/layer-settings.js";
import { Layer, PaintedLayer } from "./layers.js";
import { BackgroundEffect, BackgroundEffects, Placement } from "./background-effects.js";

const { min, max, round } = Math;

//#region Background layer
export class BackgroundLayer extends Layer {
	static #limit: number = 3840;
	static #overscan: number = 0.08;
	#master: ImageBitmap | null = null;
	#ticket: number = 0;
	#fit: BackgroundFit = BackgroundFit.cover;
	#kind: BackgroundEffectKind = BackgroundEffectKind.none;
	#effect: BackgroundEffect = BackgroundEffects.create(BackgroundEffectKind.none);
	#intensity: number = 0;
	#placement: Placement = new Placement();
	#width: number = 0;
	#height: number = 0;
	#color: Color | null = null;
	#colorText: string | null = null;
	#canvas: OffscreenCanvas | null = null;
	#context: OffscreenCanvasRenderingContext2D | null = null;
	#isStale: boolean = true;

	constructor() {
		super("Background");
	}

	static async #decode(blob: Blob): Promise<ImageBitmap> {
		const limit = BackgroundLayer.#limit;
		const bitmap = await createImageBitmap(blob);
		if (max(bitmap.width, bitmap.height) <= limit) return bitmap;
		const scale = limit / max(bitmap.width, bitmap.height);
		const resizeWidth = round(bitmap.width * scale);
		const resizeHeight = round(bitmap.height * scale);
		bitmap.close();
		return await createImageBitmap(blob, { resizeWidth, resizeHeight, resizeQuality: "high" });
	}

	apply(settings: LayerSettings): void {
		super.apply(settings);
		if (!(settings instanceof BackgroundSettings)) throw new TypeError("The background layer requires background settings");
		if (!Number.isFinite(settings.intensity)) throw new TypeError(`The background effect intensity ${settings.intensity} must be a finite number`);
		if (settings.fit !== this.#fit) {
			this.#fit = settings.fit;
			this.#isStale = true;
		}
		this.#intensity = settings.intensity.clamp(0, 1);
		if (settings.effect === this.#kind) return;
		this.#kind = settings.effect;
		this.#effect = BackgroundEffects.create(settings.effect);
	}

	async setImage(blob: Blob | null): Promise<void> {
		const ticket = ++this.#ticket;
		let master: ImageBitmap | null = null;
		try {
			if (blob !== null) master = await BackgroundLayer.#decode(blob);
		} catch (reason) {
			console.error(`The background image could not be decoded:
${Error.from(reason)}`);
			return;
		}
		if (ticket !== this.#ticket) {
			if (master !== null) master.close();
			return;
		}
		const previous = this.#master;
		this.#master = master;
		this.#isStale = true;
		if (previous !== null) previous.close();
	}

	resize(width: number, height: number): void {
		super.resize(width, height);
		this.#width = width;
		this.#height = height;
		this.#isStale = true;
	}

	release(): void {
		const canvas = this.#canvas;
		if (canvas === null) return;
		canvas.width = 0;
		canvas.height = 0;
		this.#isStale = true;
	}

	#place(context: OffscreenCanvasRenderingContext2D, master: ImageBitmap): void {
		const width = this.#width;
		const height = this.#height;
		const fit = this.#fit;
		let scale: number;
		switch (fit) {
		case BackgroundFit.stretch:
			context.drawImage(master, 0, 0, width, height);
			return;
		case BackgroundFit.cover:
			scale = max(width / master.width, height / master.height);
			break;
		case BackgroundFit.contain:
			scale = min(width / master.width, height / master.height);
			break;
		default: throw new Error(`Invalid '${fit}' fit`);
		}
		const placedWidth = master.width * scale;
		const placedHeight = master.height * scale;
		context.drawImage(master, (width - placedWidth) / 2, (height - placedHeight) / 2, placedWidth, placedHeight);
	}

	#refit(master: ImageBitmap, colorText: string): OffscreenCanvas {
		const width = this.#width;
		const height = this.#height;
		let canvas = this.#canvas;
		if (canvas === null) {
			canvas = this.#canvas = new OffscreenCanvas(width, height);
			this.#context = ReferenceError.suppress(canvas.getContext("2d"), "Failed to acquire 2D rendering context for the background layer");
		}
		canvas.width = width;
		canvas.height = height;
		const context = ReferenceError.suppress(this.#context, "The background layer has no 2D rendering context");
		context.imageSmoothingQuality = "high";
		context.fillStyle = colorText;
		context.fillRect(0, 0, width, height);
		this.#place(context, master);
		this.#isStale = false;
		return canvas;
	}

	#blitMoved(stage: StageHost, output: OffscreenCanvasRenderingContext2D, canvas: OffscreenCanvas): void {
		const width = this.#width;
		const height = this.#height;
		const placement = this.#placement;
		placement.reset();
		this.#effect.place(stage, this.#intensity, placement);
		placement.clamp(width, height, BackgroundLayer.#overscan);
		const scale = placement.scale * (1 + BackgroundLayer.#overscan);
		output.save();
		output.setTransform(scale, 0, 0, scale, (width - scale * width) / 2 + placement.x, (height - scale * height) / 2 + placement.y);
		output.drawImage(canvas, 0, 0);
		output.restore();
	}

	render(stage: StageHost, output: OffscreenCanvasRenderingContext2D): void {
		const color = stage.environment.colorBackground;
		let colorText = this.#colorText;
		if (color !== this.#color || colorText === null) {
			colorText = color.toString();
			this.#color = color;
			this.#colorText = colorText;
			this.#isStale = true;
		}
		output.globalAlpha = this.opacity;
		output.globalCompositeOperation = this.blend as GlobalCompositeOperation;
		const master = this.#master;
		if (master === null) {
			output.fillStyle = colorText;
			output.fillRect(0, 0, this.#width, this.#height);
			return;
		}
		let canvas = this.#canvas;
		if (this.#isStale || canvas === null) canvas = this.#refit(master, colorText);
		if (this.#kind === BackgroundEffectKind.none) {
			output.drawImage(canvas, 0, 0);
			return;
		}
		this.#blitMoved(stage, output, canvas);
	}
}
//#endregion
//#region Lyrics layer
export class LyricsLayer extends PaintedLayer {
	constructor() {
		super("Lyrics");
	}

	isIdle(stage: StageHost): boolean {
		return stage.environment.lyrics === null;
	}

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
