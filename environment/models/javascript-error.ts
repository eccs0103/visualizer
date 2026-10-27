"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region JavaScript error
export interface JavaScriptErrorScheme {
	error_message: string;
	error_source: string | undefined;
	error_line: number | undefined;
}

export class JavaScriptError extends Model {
	@Field(String, { name: "error_message" })
	message: string;

	@Field(Optional.Of(String), { name: "error_source" })
	source: string | undefined;

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
