"use strict";

import "adaptive-extender/core";
import { Deferred, Descendant, Field, Model } from "adaptive-extender/core";

class SharedArrayBufferPortable {
	static import(source: unknown, name: string): SharedArrayBuffer {
		if (source instanceof SharedArrayBuffer) return source;
		throw new TypeError(`${name} must be a SharedArrayBuffer`);
	}

	static export(source: SharedArrayBuffer): SharedArrayBuffer {
		return source;
	}
}

class OffscreenCanvasPortable {
	static import(source: unknown, name: string): OffscreenCanvas {
		if (source instanceof OffscreenCanvas) return source;
		throw new TypeError(`${name} must be an OffscreenCanvas`);
	}

	static export(source: OffscreenCanvas): OffscreenCanvas {
		return source;
	}
}

//#region Render command
export interface RenderCommandDiscriminator extends InitializeRenderCommandDiscriminator, TickCommandDiscriminator, RebuildRenderCommandDiscriminator {
}

export interface RenderCommandScheme {
	$type: keyof RenderCommandDiscriminator;
	platform: string;
	timestamp: number;
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
	sab: SharedArrayBuffer;
	canvas: OffscreenCanvas;
}

export class InitializeRenderCommand extends RenderCommand {
	@Field(SharedArrayBufferPortable)
	sab: SharedArrayBuffer;

	@Field(OffscreenCanvasPortable)
	canvas: OffscreenCanvas;

	constructor();
	constructor(sab: SharedArrayBuffer, canvas: OffscreenCanvas);
	constructor(sab?: SharedArrayBuffer, canvas?: OffscreenCanvas) {
		super();
		Object.assign(this, { sab, canvas });
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
		super();
		Object.assign(this, { width, height, visualization });
	}
}
//#endregion
