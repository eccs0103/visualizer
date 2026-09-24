"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Outbound click
export class OutboundClick extends Model {
	/** Full absolute URL of the clicked link (anchor.href). Always an external destination — only anchors with target="_blank" are tracked. */
	@Field(String, { name: "link_url" })
	url: string;

	/** Trimmed textContent of the clicked anchor element. Empty string when the link contains only an image, icon, or SVG with no visible text. */
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
