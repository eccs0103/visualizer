"use strict";

import "adaptive-extender/core";
import { Deferred, Descendant, Field, Model, Nullable } from "adaptive-extender/core";
import { LayerSettings } from "./layer-settings.js";
import { BackgroundSettings } from "./background-settings.js";

//#region Shared array buffer portable
class SharedArrayBufferPortable {
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

//#region Command
export interface CommandDiscriminator extends InitializeAnalyzerCommandDiscriminator, InitializeMaskCommandDiscriminator, InitializeRenderCommandDiscriminator, TickCommandDiscriminator, RebuildRenderCommandDiscriminator, LyricsRenderCommandDiscriminator, ShakeRenderCommandDiscriminator, LayersRenderCommandDiscriminator, ImageRenderCommandDiscriminator, ChunkCommandDiscriminator, FinishCommandDiscriminator, DoneCommandDiscriminator {
}

export interface CommandScheme {
	$type: keyof CommandDiscriminator;
}

@Descendant(Deferred(_ => InitializeAnalyzerCommand))
@Descendant(Deferred(_ => InitializeMaskCommand))
@Descendant(Deferred(_ => InitializeRenderCommand))
@Descendant(Deferred(_ => TickCommand))
@Descendant(Deferred(_ => RebuildRenderCommand))
@Descendant(Deferred(_ => LyricsRenderCommand))
@Descendant(Deferred(_ => ShakeRenderCommand))
@Descendant(Deferred(_ => LayersRenderCommand))
@Descendant(Deferred(_ => ImageRenderCommand))
@Descendant(Deferred(_ => ChunkCommand))
@Descendant(Deferred(_ => FinishCommand))
@Descendant(Deferred(_ => DoneCommand))
export abstract class Command extends Model {
	constructor() {
		super();
		if (new.target === Command) throw new TypeError("Unable to create an instance of an abstract class");
	}
}
//#endregion
//#region Initialize analyzer command
export interface InitializeAnalyzerCommandDiscriminator {
	"InitializeAnalyzerCommand": InitializeAnalyzerCommand;
}

export interface InitializeAnalyzerCommandScheme extends CommandScheme {
	$type: keyof InitializeAnalyzerCommandDiscriminator;
	sabSignal: SharedArrayBuffer;
	sabFeatures: SharedArrayBuffer;
	sabMask: SharedArrayBuffer;
	sampleRate: number;
}

export class InitializeAnalyzerCommand extends Command {
	@Field(SharedArrayBufferPortable)
	sabSignal: SharedArrayBuffer;

	@Field(SharedArrayBufferPortable)
	sabFeatures: SharedArrayBuffer;

	@Field(SharedArrayBufferPortable)
	sabMask: SharedArrayBuffer;

	@Field(Number)
	sampleRate: number;

	constructor();
	constructor(sabSignal: SharedArrayBuffer, sabFeatures: SharedArrayBuffer, sabMask: SharedArrayBuffer, sampleRate: number);
	constructor(sabSignal?: SharedArrayBuffer, sabFeatures?: SharedArrayBuffer, sabMask?: SharedArrayBuffer, sampleRate?: number) {
		if (sabSignal === undefined || sabFeatures === undefined || sabMask === undefined || sampleRate === undefined) {
			super();
			return;
		}

		super();
		this.sabSignal = sabSignal;
		this.sabFeatures = sabFeatures;
		this.sabMask = sabMask;
		this.sampleRate = sampleRate;
	}
}
//#endregion
//#region Initialize mask command
export interface InitializeMaskCommandDiscriminator {
	"InitializeMaskCommand": InitializeMaskCommand;
}

export interface InitializeMaskCommandScheme extends CommandScheme {
	$type: keyof InitializeMaskCommandDiscriminator;
	sabSignal: SharedArrayBuffer;
	sabMask: SharedArrayBuffer;
	urlModel: string;
	urlWasm: string;
}

export class InitializeMaskCommand extends Command {
	@Field(SharedArrayBufferPortable)
	sabSignal: SharedArrayBuffer;

	@Field(SharedArrayBufferPortable)
	sabMask: SharedArrayBuffer;

	@Field(String)
	urlModel: string;

	@Field(String)
	urlWasm: string;

	constructor();
	constructor(sabSignal: SharedArrayBuffer, sabMask: SharedArrayBuffer, urlModel: string, urlWasm: string);
	constructor(sabSignal?: SharedArrayBuffer, sabMask?: SharedArrayBuffer, urlModel?: string, urlWasm?: string) {
		if (sabSignal === undefined || sabMask === undefined || urlModel === undefined || urlWasm === undefined) {
			super();
			return;
		}

		super();
		this.sabSignal = sabSignal;
		this.sabMask = sabMask;
		this.urlModel = urlModel;
		this.urlWasm = urlWasm;
	}
}
//#endregion
//#region Initialize render command
export interface InitializeRenderCommandDiscriminator {
	"InitializeRenderCommand": InitializeRenderCommand;
}

export interface InitializeRenderCommandScheme extends CommandScheme {
	$type: keyof InitializeRenderCommandDiscriminator;
	sabSignal: SharedArrayBuffer;
	sabFeatures: SharedArrayBuffer;
	sabMask: SharedArrayBuffer;
	canvas: OffscreenCanvas;
}

export class InitializeRenderCommand extends Command {
	@Field(SharedArrayBufferPortable)
	sabSignal: SharedArrayBuffer;

	@Field(SharedArrayBufferPortable)
	sabFeatures: SharedArrayBuffer;

	@Field(SharedArrayBufferPortable)
	sabMask: SharedArrayBuffer;

	@Field(OffscreenCanvasPortable)
	canvas: OffscreenCanvas;

	constructor();
	constructor(sabSignal: SharedArrayBuffer, sabFeatures: SharedArrayBuffer, sabMask: SharedArrayBuffer, canvas: OffscreenCanvas);
	constructor(sabSignal?: SharedArrayBuffer, sabFeatures?: SharedArrayBuffer, sabMask?: SharedArrayBuffer, canvas?: OffscreenCanvas) {
		if (sabSignal === undefined || sabFeatures === undefined || sabMask === undefined || canvas === undefined) {
			super();
			return;
		}

		super();
		this.sabSignal = sabSignal;
		this.sabFeatures = sabFeatures;
		this.sabMask = sabMask;
		this.canvas = canvas;
	}
}
//#endregion
//#region Tick command
export interface TickCommandDiscriminator {
	"TickCommand": TickCommand;
}

export interface TickCommandScheme extends CommandScheme {
	$type: keyof TickCommandDiscriminator;
}

export class TickCommand extends Command {
}
//#endregion
//#region Rebuild render command
export interface RebuildRenderCommandDiscriminator {
	"RebuildRenderCommand": RebuildRenderCommand;
}

export interface RebuildRenderCommandScheme extends CommandScheme {
	$type: keyof RebuildRenderCommandDiscriminator;
	width: number;
	height: number;
	visualization: string;
	hue: number;
	saturation: number;
	lightness: number;
}

export class RebuildRenderCommand extends Command {
	@Field(Number)
	width: number;

	@Field(Number)
	height: number;

	@Field(String)
	visualization: string;

	@Field(Number)
	hue: number;

	@Field(Number)
	saturation: number;

	@Field(Number)
	lightness: number;

	constructor();
	constructor(width: number, height: number, visualization: string, hue: number, saturation: number, lightness: number);
	constructor(width?: number, height?: number, visualization?: string, hue?: number, saturation?: number, lightness?: number) {
		if (width === undefined || height === undefined || visualization === undefined || hue === undefined || saturation === undefined || lightness === undefined) {
			super();
			return;
		}

		super();
		this.width = width;
		this.height = height;
		this.visualization = visualization;
		this.hue = hue;
		this.saturation = saturation;
		this.lightness = lightness;
	}
}
//#endregion
//#region Lyrics render command
export interface LyricsRenderCommandDiscriminator {
	"LyricsRenderCommand": LyricsRenderCommand;
}

export interface LyricsRenderCommandScheme extends CommandScheme {
	$type: keyof LyricsRenderCommandDiscriminator;
	previous: string | null;
	current: string | null;
	next: string | null;
}

export class LyricsRenderCommand extends Command {
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

export interface ShakeRenderCommandScheme extends CommandScheme {
	$type: keyof ShakeRenderCommandDiscriminator;
	value: number;
}

export class ShakeRenderCommand extends Command {
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

export interface LayersRenderCommandScheme extends CommandScheme {
	$type: keyof LayersRenderCommandDiscriminator;
	visualization: string;
	layers: LayerSettings[];
	background: BackgroundSettings;
	lyrics: LayerSettings;
}

export class LayersRenderCommand extends Command {
	@Field(String)
	visualization: string;

	@Field(Array.Of(LayerSettings))
	layers: LayerSettings[];

	@Field(BackgroundSettings)
	background: BackgroundSettings;

	@Field(LayerSettings)
	lyrics: LayerSettings;

	constructor();
	constructor(visualization: string, layers: LayerSettings[], background: BackgroundSettings, lyrics: LayerSettings);
	constructor(visualization?: string, layers?: LayerSettings[], background?: BackgroundSettings, lyrics?: LayerSettings) {
		if (visualization === undefined || layers === undefined || background === undefined || lyrics === undefined) {
			super();
			return;
		}

		super();
		this.visualization = visualization;
		this.layers = layers;
		this.background = background;
		this.lyrics = lyrics;
	}
}
//#endregion
//#region Image render command
export interface ImageRenderCommandDiscriminator {
	"ImageRenderCommand": ImageRenderCommand;
}

export interface ImageRenderCommandScheme extends CommandScheme {
	$type: keyof ImageRenderCommandDiscriminator;
	visualization: string;
	image: Blob | null;
}

export class ImageRenderCommand extends Command {
	@Field(String)
	visualization: string;

	@Field(Nullable.Of(BlobPortable))
	image: Blob | null;

	constructor();
	constructor(visualization: string, image: Blob | null);
	constructor(visualization?: string, image?: Blob | null) {
		if (visualization === undefined || image === undefined) {
			super();
			return;
		}

		super();
		this.visualization = visualization;
		this.image = image;
	}
}
//#endregion
//#region Chunk command
export interface ChunkCommandDiscriminator {
	"ChunkCommand": ChunkCommand;
}

export interface ChunkCommandScheme extends CommandScheme {
	$type: keyof ChunkCommandDiscriminator;
	data: Blob;
}

export class ChunkCommand extends Command {
	@Field(BlobPortable)
	data: Blob;

	constructor();
	constructor(data: Blob);
	constructor(data?: Blob) {
		if (data === undefined) {
			super();
			return;
		}

		super();
		this.data = data;
	}
}
//#endregion
//#region Finish command
export interface FinishCommandDiscriminator {
	"FinishCommand": FinishCommand;
}

export interface FinishCommandScheme extends CommandScheme {
	$type: keyof FinishCommandDiscriminator;
	mimeType: string;
}

export class FinishCommand extends Command {
	@Field(String)
	mimeType: string;

	constructor();
	constructor(mimeType: string);
	constructor(mimeType?: string) {
		if (mimeType === undefined) {
			super();
			return;
		}

		super();
		this.mimeType = mimeType;
	}
}
//#endregion
//#region Done command
export interface DoneCommandDiscriminator {
	"DoneCommand": DoneCommand;
}

export interface DoneCommandScheme extends CommandScheme {
	$type: keyof DoneCommandDiscriminator;
	blob: Blob;
}

export class DoneCommand extends Command {
	@Field(BlobPortable)
	blob: Blob;

	constructor();
	constructor(blob: Blob);
	constructor(blob?: Blob) {
		if (blob === undefined) {
			super();
			return;
		}

		super();
		this.blob = blob;
	}
}
//#endregion
