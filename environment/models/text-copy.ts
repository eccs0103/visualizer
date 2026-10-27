"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Text copy
export interface TextCopyScheme {
	copy_text: string;
}

export class TextCopy extends Model {
	@Field(String, { name: "copy_text" })
	text: string;

	constructor();
	constructor(text: string);
	constructor(text?: string) {
		if (text === undefined) {
			super();
			return;
		}

		super();
		this.text = text;
	}
}
//#endregion
