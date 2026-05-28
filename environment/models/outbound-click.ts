"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Outbound click
export class OutboundClick extends Model {
	/** Full absolute URL of the clicked link (anchor.href). Always an external destination — only anchors with target="_blank" are tracked. */
	@Field(String, "link_url")
	linkUrl: string;

	/** Trimmed textContent of the clicked anchor element. Empty string when the link contains only an image, icon, or SVG with no visible text. */
	@Field(String, "link_text")
	linkText: string;

	constructor();
	constructor(linkUrl: string, linkText: string);
	constructor(linkUrl?: string, linkText?: string) {
		if (linkUrl === undefined || linkText === undefined) {
			super();
			return;
		}

		super();
		this.linkUrl = linkUrl;
		this.linkText = linkText;
	}
}
//#endregion
