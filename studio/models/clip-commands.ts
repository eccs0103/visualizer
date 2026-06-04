"use strict";

import "adaptive-extender/core";
import { Deferred, Descendant, Field, Model } from "adaptive-extender/core";

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

//#region Clip command
export interface ClipCommandDiscriminator extends ChunkCommandDiscriminator, FinishCommandDiscriminator, DoneCommandDiscriminator {
}

export interface ClipCommandScheme {
	$type: keyof ClipCommandDiscriminator;
	platform: string;
	timestamp: number;
}

@Descendant(Deferred(_ => ChunkCommand))
@Descendant(Deferred(_ => FinishCommand))
@Descendant(Deferred(_ => DoneCommand))
export abstract class ClipCommand extends Model {
	constructor() {
		super();
		if (new.target === ClipCommand) throw new TypeError("Unable to create an instance of an abstract class");
	}
}
//#endregion
//#region Chunk command
export interface ChunkCommandDiscriminator {
	"ChunkCommand": ChunkCommand;
}

export interface ChunkCommandScheme extends ClipCommandScheme {
	$type: keyof ChunkCommandDiscriminator;
	data: Blob;
}

export class ChunkCommand extends ClipCommand {
	@Field(BlobPortable)
	data: Blob;

	constructor();
	constructor(data: Blob);
	constructor(data?: Blob) {
		super();
		Object.assign(this, { data });
	}
}
//#endregion
//#region Finish command
export interface FinishCommandDiscriminator {
	"FinishCommand": FinishCommand;
}

export interface FinishCommandScheme extends ClipCommandScheme {
	$type: keyof FinishCommandDiscriminator;
	mimeType: string;
}

export class FinishCommand extends ClipCommand {
	@Field(String)
	mimeType: string;

	constructor();
	constructor(mimeType: string);
	constructor(mimeType?: string) {
		super();
		Object.assign(this, { mimeType });
	}
}
//#endregion
//#region Done command
export interface DoneCommandDiscriminator {
	"DoneCommand": DoneCommand;
}

export interface DoneCommandScheme extends ClipCommandScheme {
	$type: keyof DoneCommandDiscriminator;
	blob: Blob;
}

export class DoneCommand extends ClipCommand {
	@Field(BlobPortable)
	blob: Blob;

	constructor();
	constructor(blob: Blob);
	constructor(blob?: Blob) {
		super();
		Object.assign(this, { blob });
	}
}
//#endregion
