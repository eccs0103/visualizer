"use strict";

import "adaptive-extender/worker";

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
export class BlobPortable {
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
export class OffscreenCanvasPortable {
	static import(source: unknown, name: string): OffscreenCanvas {
		if (source instanceof OffscreenCanvas) return source;
		throw new TypeError(`${name} must be an OffscreenCanvas`);
	}

	static export(source: OffscreenCanvas): OffscreenCanvas {
		return source;
	}
}
//#endregion
