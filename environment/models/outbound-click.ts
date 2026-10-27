"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Outbound click
export interface OutboundClickScheme {
	link_url: string;
	link_text: string;
}

export class OutboundClick extends Model {
	@Field(String, { name: "link_url" })
	url: string;

	@Field(String, { name: "link_text" })
	text: string;

	constructor();
	constructor(url: string, text: string);
	constructor(url?: string, text?: string) {
		if (url === undefined || text === undefined) {
			super();
			return;
		}

		super();
		this.url = url;
		this.text = text;
	}
}
//#endregion
