"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Text copy
export class TextCopy extends Model {
	/** Trimmed text selected and copied by the user. Not recorded when the selection collapses to an empty string (accidental ctrl+c without a selection). */
	@Field(String, "copy_text")
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
