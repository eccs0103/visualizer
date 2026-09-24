"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region JavaScript error
export class JavaScriptError extends Model {
	/** Error.message from the thrown error or rejection value. For unhandled rejections, normalised through Error.from() so non-Error rejections (strings, objects) still produce a readable message. */
	@Field(String, { name: "error_message" })
	message: string;

	/** ErrorEvent.filename — URL of the script file where the error occurred. Absent for unhandled promise rejections and for errors in cross-origin scripts blocked by the browser's CORS policy. */
	@Field(Optional.Of(String), { name: "error_source" })
	source: string | undefined;

	/** ErrorEvent.lineno — 1-based line number in the source file at the throw site. Not meaningful for minified builds; use a source-map service to resolve it. Absent for cross-origin and rejection events. */
	@Field(Optional.Of(Number), { name: "error_line" })
	line: number | undefined;

	constructor();
	constructor(message: string, source: string | undefined, line: number | undefined);
	constructor(message?: string, source?: string, line?: number) {
		if (message === undefined) {
			super();
			return;
		}

		super();
		this.message = message;
		this.source = source;
		this.line = line;
	}
}
//#endregion
