"use strict";

import "adaptive-extender/web";
import { type Timespan } from "adaptive-extender/web";
import { TextExpert } from "../services/text-expert.js";

//#region DOM builder
export class DOMBuilder {
	static newIcon(parent: Element, label: string): HTMLElement {
		const icon = parent.appendChild(document.createElement("span"));
		icon.classList.add("icon", "with-padding");
		icon.translate = true;
		icon.innerText = label;
		icon.title = label;
		return icon;
	}

	static newHandle(row: HTMLLIElement): HTMLElement {
		const handle = row.appendChild(document.createElement("span"));
		handle.classList.add("handle", "with-padding", "flex", "alt-center");
		handle.translate = true;
		handle.tabIndex = 0;
		DOMBuilder.newIcon(handle, "Drag to reorder (or focus and press ↑/↓)");
		return handle;
	}

	static newPin(row: HTMLLIElement): HTMLElement {
		const pin = row.appendChild(document.createElement("span"));
		pin.classList.add("pin", "with-padding", "flex", "alt-center");
		pin.translate = true;
		pin.ariaHidden = String(true);
		DOMBuilder.newIcon(pin, "Pinned");
		return pin;
	}

	static newGroup(parent: Element, title: string): HTMLElement {
		const group = parent.appendChild(document.createElement("section"));
		group.classList.add("option", "layer", "with-padding", "large-padding");
		group.translate = true;
		const heading = group.appendChild(document.createElement("h3"));
		heading.classList.add("title");
		heading.translate = false;
		heading.innerText = title;
		return group;
	}

	static newOption(parent: Element, title: string, definition: string): HTMLElement {
		const option = parent.appendChild(document.createElement("section"));
		option.classList.add("option");
		option.translate = true;
		const heading = option.appendChild(document.createElement("h4"));
		heading.classList.add("title");
		heading.translate = true;
		heading.innerText = title;
		const description = option.appendChild(document.createElement("span"));
		description.classList.add("definition", "description");
		description.translate = true;
		description.innerText = definition;
		return option;
	}

	static newTitle(content: Element, text: string): HTMLElement {
		const title = content.appendChild(document.createElement("span"));
		title.classList.add("title", "fittable");
		title.translate = false;
		title.innerText = text;
		return title;
	}

	static newDuration(content: Element, time: Readonly<Timespan>): HTMLElement {
		const itemDuration = content.appendChild(document.createElement("b"));
		itemDuration.translate = false;
		itemDuration.innerText = TextExpert.formatDuration(time);
		return itemDuration;
	}

	static newLyricsMark(content: Element): HTMLElement {
		const mark = content.appendChild(document.createElement("span"));
		mark.classList.add("lyrics-mark", "flex", "alt-center");
		mark.translate = true;
		DOMBuilder.newIcon(mark, "Lyrics attached");
		return mark;
	}

	static newRemoveButton(row: HTMLLIElement): HTMLButtonElement {
		const buttonRemove = row.appendChild(document.createElement("button"));
		buttonRemove.type = "button";
		buttonRemove.classList.add("remove", "with-padding", "flex", "alt-center", "alert");
		buttonRemove.translate = true;
		DOMBuilder.newIcon(buttonRemove, "Remove track");
		return buttonRemove;
	}
}
//#endregion
