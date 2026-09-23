"use strict";

import "adaptive-extender/core";
import { Deferred, Descendant, Field, Model, Nullable } from "adaptive-extender/core";
import { LayerSettings } from "./layer-settings.js";
import { BackgroundSettings } from "./engine-settings.js";

//#region Shared array buffer portable
export class SharedArrayBufferPortable {
	static import(source: unknown, name: string): SharedArrayBuffer {
		if (source instanceof SharedArrayBuffer) return source;
		throw new TypeError(`${name} must be a SharedArrayBuffer`);
	}

	static export(source: SharedArrayBuffer): SharedArrayBuffer {
		return source;
	}
}
//#endregion
//#region Blob portable
class BlobPortable {
	static import(source: unknown, name: string): Blob {
		if (source instanceof Blob) return source;
		throw new TypeError(`${name} must be a Blob`);
	}

	static export(source: Blob): Blob {
		return source;
	}
}
//#endregion
//#region Offscreen canvas portable
class OffscreenCanvasPortable {
	static import(source: unknown, name: string): OffscreenCanvas {
		if (source instanceof OffscreenCanvas) return source;
		throw new TypeError(`${name} must be an OffscreenCanvas`);
	}

	static export(source: OffscreenCanvas): OffscreenCanvas {
		return source;
	}
}
//#endregion

//#region Render command
export interface RenderCommandDiscriminator extends InitializeRenderCommandDiscriminator, TickCommandDiscriminator, RebuildRenderCommandDiscriminator, LyricsRenderCommandDiscriminator, ShakeRenderCommandDiscriminator, LayersRenderCommandDiscriminator, EngineRenderCommandDiscriminator, ImageRenderCommandDiscriminator {
}

export interface RenderCommandScheme {
	$type: keyof RenderCommandDiscriminator;
}

@Descendant(Deferred(_ => InitializeRenderCommand))
@Descendant(Deferred(_ => TickCommand))
@Descendant(Deferred(_ => RebuildRenderCommand))
@Descendant(Deferred(_ => LyricsRenderCommand))
@Descendant(Deferred(_ => ShakeRenderCommand))
@Descendant(Deferred(_ => LayersRenderCommand))
@Descendant(Deferred(_ => EngineRenderCommand))
@Descendant(Deferred(_ => ImageRenderCommand))
export abstract class RenderCommand extends Model {
	constructor() {
		super();
		if (new.target === RenderCommand) throw new TypeError("Unable to create an instance of an abstract class");
	}
}
//#endregion
//#region Initialize render command
export interface InitializeRenderCommandDiscriminator {
	"InitializeRenderCommand": InitializeRenderCommand;
}

export interface InitializeRenderCommandScheme extends RenderCommandScheme {
	$type: keyof InitializeRenderCommandDiscriminator;
	sabVideo: SharedArrayBuffer;
	sabAudio: SharedArrayBuffer;
	canvas: OffscreenCanvas;
}

export class InitializeRenderCommand extends RenderCommand {
	@Field(SharedArrayBufferPortable)
	sabVideo: SharedArrayBuffer;

	@Field(SharedArrayBufferPortable)
	sabAudio: SharedArrayBuffer;

	@Field(OffscreenCanvasPortable)
	canvas: OffscreenCanvas;

	constructor();
	constructor(sabVideo: SharedArrayBuffer, sabAudio: SharedArrayBuffer, canvas: OffscreenCanvas);
	constructor(sabVideo?: SharedArrayBuffer, sabAudio?: SharedArrayBuffer, canvas?: OffscreenCanvas) {
		if (sabVideo === undefined || sabAudio === undefined || canvas === undefined) {
			super();
			return;
		}

		super();
		this.sabVideo = sabVideo;
		this.sabAudio = sabAudio;
		this.canvas = canvas;
	}
}
//#endregion
//#region Tick command
export interface TickCommandDiscriminator {
	"TickCommand": TickCommand;
}

export interface TickCommandScheme extends RenderCommandScheme {
	$type: keyof TickCommandDiscriminator;
}

export class TickCommand extends RenderCommand {
}
//#endregion
//#region Rebuild render command
export interface RebuildRenderCommandDiscriminator {
	"RebuildRenderCommand": RebuildRenderCommand;
}

export interface RebuildRenderCommandScheme extends RenderCommandScheme {
	$type: keyof RebuildRenderCommandDiscriminator;
	width: number;
	height: number;
	visualization: string;
}

export class RebuildRenderCommand extends RenderCommand {
	@Field(Number)
	width: number;

	@Field(Number)
	height: number;

	@Field(String)
	visualization: string;

	constructor();
	constructor(width: number, height: number, visualization: string);
	constructor(width?: number, height?: number, visualization?: string) {
		if (width === undefined || height === undefined || visualization === undefined) {
			super();
			return;
		}

		super();
		this.width = width;
		this.height = height;
		this.visualization = visualization;
	}
}
//#endregion
//#region Lyrics render command
export interface LyricsRenderCommandDiscriminator {
	"LyricsRenderCommand": LyricsRenderCommand;
}

export interface LyricsRenderCommandScheme extends RenderCommandScheme {
	$type: keyof LyricsRenderCommandDiscriminator;
	previous: string | null;
	current: string | null;
	next: string | null;
}

export class LyricsRenderCommand extends RenderCommand {
	@Field(Nullable.Of(String))
	previous: string | null;

	@Field(Nullable.Of(String))
	current: string | null;

	@Field(Nullable.Of(String))
	next: string | null;

	constructor();
	constructor(previous: string | null, current: string | null, next: string | null);
	constructor(previous?: string | null, current?: string | null, next?: string | null) {
		if (previous === undefined || current === undefined || next === undefined) {
			super();
			return;
		}

		super();
		this.previous = previous;
		this.current = current;
		this.next = next;
	}
}
//#endregion
//#region Shake render command
export interface ShakeRenderCommandDiscriminator {
	"ShakeRenderCommand": ShakeRenderCommand;
}

export interface ShakeRenderCommandScheme extends RenderCommandScheme {
	$type: keyof ShakeRenderCommandDiscriminator;
	value: number;
}

export class ShakeRenderCommand extends RenderCommand {
	@Field(Number)
	value: number;

	constructor();
	constructor(value: number);
	constructor(value?: number) {
		if (value === undefined) {
			super();
			return;
		}

		super();
		this.value = value;
	}
}
//#endregion
//#region Layers render command
export interface LayersRenderCommandDiscriminator {
	"LayersRenderCommand": LayersRenderCommand;
}

export interface LayersRenderCommandScheme extends RenderCommandScheme {
	$type: keyof LayersRenderCommandDiscriminator;
	visualization: string;
	layers: LayerSettings[];
}

export class LayersRenderCommand extends RenderCommand {
	@Field(String)
	visualization: string;

	@Field(Array.Of(LayerSettings))
	layers: LayerSettings[];

	constructor();
	constructor(visualization: string, layers: LayerSettings[]);
	constructor(visualization?: string, layers?: LayerSettings[]) {
		if (visualization === undefined || layers === undefined) {
			super();
			return;
		}

		super();
		this.visualization = visualization;
		this.layers = layers;
	}
}
//#endregion
//#region Engine render command
export interface EngineRenderCommandDiscriminator {
	"EngineRenderCommand": EngineRenderCommand;
}

export interface EngineRenderCommandScheme extends RenderCommandScheme {
	$type: keyof EngineRenderCommandDiscriminator;
	background: BackgroundSettings;
	lyrics: LayerSettings;
}

export class EngineRenderCommand extends RenderCommand {
	@Field(BackgroundSettings)
	background: BackgroundSettings;

	@Field(LayerSettings)
	lyrics: LayerSettings;

	constructor();
	constructor(background: BackgroundSettings, lyrics: LayerSettings);
	constructor(background?: BackgroundSettings, lyrics?: LayerSettings) {
		if (background === undefined || lyrics === undefined) {
			super();
			return;
		}

		super();
		this.background = background;
		this.lyrics = lyrics;
	}
}
//#endregion
//#region Image render command
export interface ImageRenderCommandDiscriminator {
	"ImageRenderCommand": ImageRenderCommand;
}

export interface ImageRenderCommandScheme extends RenderCommandScheme {
	$type: keyof ImageRenderCommandDiscriminator;
	image: Blob | null;
}

export class ImageRenderCommand extends RenderCommand {
	@Field(Nullable.Of(BlobPortable))
	image: Blob | null;

	constructor();
	constructor(image: Blob | null);
	constructor(image?: Blob | null) {
		if (image === undefined) {
			super();
			return;
		}

		super();
		this.image = image;
	}
}
//#endregion
