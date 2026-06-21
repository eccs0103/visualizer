"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region JavaScript error
export class JavaScriptError extends Model {
	/** Error.message from the thrown error or rejection value. For unhandled rejections, normalised through Error.from() so non-Error rejections (strings, objects) still produce a readable message. */
	@Field(String, { name: "error_message" })
	errorMessage: string;

	/** ErrorEvent.filename — URL of the script file where the error occurred. Absent for unhandled promise rejections and for errors in cross-origin scripts blocked by the browser's CORS policy. */
	@Field(Optional.Of(String), { name: "error_source" })
	errorSource: string | undefined;

	/** ErrorEvent.lineno — 1-based line number in the source file at the throw site. Not meaningful for minified builds; use a source-map service to resolve it. Absent for cross-origin and rejection events. */
	@Field(Optional.Of(Number), { name: "error_line" })
	errorLine: number | undefined;

	constructor();
	constructor(errorMessage: string, errorSource: string | undefined, errorLine: number | undefined);
	constructor(errorMessage?: string, errorSource?: string, errorLine?: number) {
		if (errorMessage === undefined) {
			super();
			return;
		}

		super();
		this.errorMessage = errorMessage;
		this.errorSource = errorSource;
		this.errorLine = errorLine;
	}
}
//#endregion
