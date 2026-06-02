"use strict";

import "adaptive-extender/core";
import { Deferred, Descendant, Field, Model } from "adaptive-extender/core";

//#region Render command
export interface RenderCommandDiscriminator extends RebuildRenderCommandDiscriminator {
}

export interface RenderCommandScheme {
	$type: keyof RenderCommandDiscriminator;
	platform: string;
	timestamp: number;
}

@Descendant(Deferred(_ => RebuildRenderCommand))
export abstract class RenderCommand extends Model {
	constructor() {
		super();
		if (new.target === RenderCommand) throw new TypeError("Unable to create an instance of an abstract class");
	}
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
