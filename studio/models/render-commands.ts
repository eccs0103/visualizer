"use strict";

import "adaptive-extender/core";
import { Deferred, Descendant, Field, Model } from "adaptive-extender/core";

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
export interface RenderCommandDiscriminator extends InitializeRenderCommandDiscriminator, TickCommandDiscriminator, RebuildRenderCommandDiscriminator {
}

export interface RenderCommandScheme {
	$type: keyof RenderCommandDiscriminator;
}

@Descendant(Deferred(_ => InitializeRenderCommand))
@Descendant(Deferred(_ => TickCommand))
@Descendant(Deferred(_ => RebuildRenderCommand))
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
