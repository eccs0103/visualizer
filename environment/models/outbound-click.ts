"use strict";

import "adaptive-extender/core";
import { Field, Model, URI } from "adaptive-extender/core";

//#region Outbound click
export interface OutboundClickScheme {
	link_url: string;
	link_text: string;
}

export class OutboundClick extends Model {
	@Field(URI, { name: "link_url" })
	url: URI;

	@Field(String, { name: "link_text" })
	text: string;

	constructor();
	constructor(url: URI, text: string);
	constructor(url?: URI, text?: string) {
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
