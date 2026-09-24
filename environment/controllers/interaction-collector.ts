"use strict";

import "adaptive-extender/web";
import { OutboundClick } from "../models/outbound-click.js";
import { TextCopy } from "../models/text-copy.js";
import { AnalyticsService } from "../services/analytics-service.js";
import { Controller } from "adaptive-extender/web";

const analytics = AnalyticsService.instance;

//#region Interaction collector
export class InteractionCollector extends Controller {
	async run(): Promise<void> {
		document.addEventListener("click", this.#onClick.bind(this));
		document.addEventListener("copy", this.#onCopy.bind(this));
	}

	#onClick(event: MouseEvent): void {
		const anchor = event.composedPath().find(node => node instanceof HTMLAnchorElement);
		if (anchor === undefined) return;
		const { href } = anchor;
		if (String.isWhitespace(href) || anchor.target !== "_blank") return;
		const text = anchor.textContent.trim();
		analytics.dispatch("outbound_click", new OutboundClick(href, text));
	}

	#onCopy(): void {
		const selection = window.getSelection();
		if (selection === null) return;
		const text = selection.toString();
		if (String.isWhitespace(text)) return;
		analytics.dispatch("text_copy", new TextCopy(text));
	}

	async catch(error: Error): Promise<void> {
		console.error(`Interaction collection failed:\n${error}`);
	}
}
//#endregion
