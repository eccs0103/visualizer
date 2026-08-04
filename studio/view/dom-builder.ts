"use strict";

import "adaptive-extender/web";
import { type Timespan } from "adaptive-extender/web";
import { TextExpert } from "../services/text-expert.js";

//#region DOM builder
export class DOMBuilder {
	static newIcon(parent: Element, label: string): HTMLElement {
		const icon = parent.appendChild(document.createElement("span"));
		icon.classList.add("icon", "with-padding");
		icon.innerText = label;
		return icon;
	}

	static newHandle(row: HTMLLIElement): HTMLElement {
		const handle = row.appendChild(document.createElement("span"));
		handle.classList.add("handle", "with-padding", "flex", "alt-center");
		handle.tabIndex = 0;
		DOMBuilder.newIcon(handle, "Drag to reorder");
		return handle;
	}

	static newTitle(content: Element, text: string): HTMLElement {
		const title = content.appendChild(document.createElement("span"));
		title.classList.add("title", "fittable");
		title.innerText = text;
		return title;
	}

	static newDuration(content: Element, time: Readonly<Timespan>): HTMLElement {
		const itemDuration = content.appendChild(document.createElement("b"));
		itemDuration.innerText = TextExpert.formatDuration(time);
		return itemDuration;
	}

	static newRemoveButton(row: HTMLLIElement): HTMLButtonElement {
		const buttonRemove = row.appendChild(document.createElement("button"));
		buttonRemove.type = "button";
		buttonRemove.classList.add("remove", "with-padding", "flex", "alt-center", "alert");
		DOMBuilder.newIcon(buttonRemove, "Remove track");
		return buttonRemove;
	}
}
//#endregion
