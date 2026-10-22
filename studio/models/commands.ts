"use strict";

import "adaptive-extender/worker";
import { Any, Deferred, Descendant, Field, Model, Nullable } from "adaptive-extender/worker";
import { LayerSettings, BackgroundSettings } from "./layer-settings.js";
import { StemGains } from "./stem.js";

//#region Command
export interface CommandDiscriminator extends InitializeMaskCommandDiscriminator, ModelMaskCommandDiscriminator, PaceMaskCommandDiscriminator, StatusMaskCommandDiscriminator, InitializeRenderCommandDiscriminator, TickCommandDiscriminator, RebuildRenderCommandDiscriminator, LyricsRenderCommandDiscriminator, ShakeRenderCommandDiscriminator, GainsRenderCommandDiscriminator, LayersRenderCommandDiscriminator, ImageRenderCommandDiscriminator, ChunkCommandDiscriminator, FinishCommandDiscriminator, DoneCommandDiscriminator {
}

export interface CommandScheme {
	$type: keyof CommandDiscriminator;
}

@Descendant(Deferred(_ => InitializeMaskCommand))
@Descendant(Deferred(_ => ModelMaskCommand))
@Descendant(Deferred(_ => PaceMaskCommand))
@Descendant(Deferred(_ => StatusMaskCommand))
@Descendant(Deferred(_ => InitializeRenderCommand))
@Descendant(Deferred(_ => TickCommand))
@Descendant(Deferred(_ => RebuildRenderCommand))
@Descendant(Deferred(_ => LyricsRenderCommand))
@Descendant(Deferred(_ => ShakeRenderCommand))
@Descendant(Deferred(_ => GainsRenderCommand))
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
//#region Initialize mask command
export interface InitializeMaskCommandDiscriminator {
	"InitializeMaskCommand": InitializeMaskCommand;
}

export interface InitializeMaskCommandScheme extends CommandScheme {
	$type: keyof InitializeMaskCommandDiscriminator;
	sabSignal: SharedArrayBuffer;
	sabMask: SharedArrayBuffer;
	urlShaders: string;
}

export class InitializeMaskCommand extends Command {
	@Field(Any.ByReference(SharedArrayBuffer))
	sabSignal: SharedArrayBuffer;

	@Field(Any.ByReference(SharedArrayBuffer))
	sabMask: SharedArrayBuffer;

	@Field(String)
	urlShaders: string;

	constructor();
	constructor(sabSignal: SharedArrayBuffer, sabMask: SharedArrayBuffer, urlShaders: string);
	constructor(sabSignal?: SharedArrayBuffer, sabMask?: SharedArrayBuffer, urlShaders?: string) {
		if (sabSignal === undefined || sabMask === undefined || urlShaders === undefined) {
			super();
			return;
		}

		super();
		this.sabSignal = sabSignal;
		this.sabMask = sabMask;
		this.urlShaders = urlShaders;
	}
}
//#endregion
//#region Model mask command
export interface ModelMaskCommandDiscriminator {
	"ModelMaskCommand": ModelMaskCommand;
}

export interface ModelMaskCommandScheme extends CommandScheme {
	$type: keyof ModelMaskCommandDiscriminator;
	urlModel: string | null;
}

export class ModelMaskCommand extends Command {
	@Field(Nullable.Of(String))
	urlModel: string | null;

	constructor();
	constructor(urlModel: string | null);
	constructor(urlModel?: string | null) {
		if (urlModel === undefined) {
			super();
			return;
		}

		super();
		this.urlModel = urlModel;
	}
}
//#endregion
//#region Pace mask command
export interface PaceMaskCommandDiscriminator {
	"PaceMaskCommand": PaceMaskCommand;
}

export interface PaceMaskCommandScheme extends CommandScheme {
	$type: keyof PaceMaskCommandDiscriminator;
	lagging: boolean;
}

export class PaceMaskCommand extends Command {
	@Field(Boolean)
	lagging: boolean;

	constructor();
	constructor(lagging: boolean);
	constructor(lagging?: boolean) {
		if (lagging === undefined) {
			super();
			return;
		}

		super();
		this.lagging = lagging;
	}
}
//#endregion
//#region Status mask command
export interface StatusMaskCommandDiscriminator {
	"StatusMaskCommand": StatusMaskCommand;
}

export interface StatusMaskCommandScheme extends CommandScheme {
	$type: keyof StatusMaskCommandDiscriminator;
	available: boolean;
	reason: string | null;
	device: string | null;
	rate: number | null;
	milliseconds: number | null;
	slowed: boolean;
}

export class StatusMaskCommand extends Command {
	@Field(Boolean)
	available: boolean;

	@Field(Nullable.Of(String))
	reason: string | null;

	@Field(Nullable.Of(String))
	device: string | null;

	@Field(Nullable.Of(Number))
	rate: number | null;

	@Field(Nullable.Of(Number))
	milliseconds: number | null;

	@Field(Boolean)
	slowed: boolean;

	constructor();
	constructor(available: boolean, reason: string | null, device: string | null, rate: number | null, milliseconds: number | null, slowed: boolean);
	constructor(available?: boolean, reason?: string | null, device?: string | null, rate?: number | null, milliseconds?: number | null, slowed?: boolean) {
		if (available === undefined || reason === undefined || device === undefined || rate === undefined || milliseconds === undefined || slowed === undefined) {
			super();
			return;
		}

		super();
		this.available = available;
		this.reason = reason;
		this.device = device;
		this.rate = rate;
		this.milliseconds = milliseconds;
		this.slowed = slowed;
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
	sabMask: SharedArrayBuffer;
	sampleRate: number;
	canvas: OffscreenCanvas;
}

export class InitializeRenderCommand extends Command {
	@Field(Any.ByReference(SharedArrayBuffer))
	sabSignal: SharedArrayBuffer;

	@Field(Any.ByReference(SharedArrayBuffer))
	sabMask: SharedArrayBuffer;

	@Field(Number)
	sampleRate: number;

	@Field(Any.ByReference(OffscreenCanvas))
	canvas: OffscreenCanvas;

	constructor();
	constructor(sabSignal: SharedArrayBuffer, sabMask: SharedArrayBuffer, sampleRate: number, canvas: OffscreenCanvas);
	constructor(sabSignal?: SharedArrayBuffer, sabMask?: SharedArrayBuffer, sampleRate?: number, canvas?: OffscreenCanvas) {
		if (sabSignal === undefined || sabMask === undefined || sampleRate === undefined || canvas === undefined) {
			super();
			return;
		}

		super();
		this.sabSignal = sabSignal;
		this.sabMask = sabMask;
		this.sampleRate = sampleRate;
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
//#region Gains render command
export interface GainsRenderCommandDiscriminator {
	"GainsRenderCommand": GainsRenderCommand;
}

export interface GainsRenderCommandScheme extends CommandScheme {
	$type: keyof GainsRenderCommandDiscriminator;
	gains: StemGains;
}

export class GainsRenderCommand extends Command {
	@Field(StemGains)
	gains: StemGains;

	constructor();
	constructor(gains: StemGains);
	constructor(gains?: StemGains) {
		if (gains === undefined) {
			super();
			return;
		}

		super();
		this.gains = gains;
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

	@Field(Nullable.Of(Any.ByReference(Blob)))
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
	@Field(Any.ByReference(Blob))
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
	@Field(Any.ByReference(Blob))
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
