"use strict";

import "adaptive-extender/web";
import { Blend } from "../models/blend.js";
import { BackgroundFit, type BackgroundSettings } from "../models/engine-settings.js";
import { type LayerSettings } from "../models/layer-settings.js";
import { Reorder } from "../models/playlist.js";
import { DOMBuilder } from "./dom-builder.js";
import { TrackDrag } from "./track-drag.js";

//#region Layers view
export interface LayersViewEventMap {
	"adjust": CustomEvent<LayerSettings>;
	"reorder": CustomEvent<Reorder>;
	"upload": CustomEvent<File>;
	"remove": Event;
}

export class LayersView extends EventTarget {
	#olVisualizationLayers: HTMLOListElement;
	#drag: TrackDrag | null = null;

	constructor(olVisualizationLayers: HTMLOListElement) {
		super();
		this.#olVisualizationLayers = olVisualizationLayers;
		olVisualizationLayers.addEventListener("pointerdown", this.#onPointerDown.bind(this));
		olVisualizationLayers.addEventListener("pointermove", this.#onPointerMove.bind(this));
		olVisualizationLayers.addEventListener("pointerup", this.#onPointerUp.bind(this));
		olVisualizationLayers.addEventListener("pointercancel", this.#onPointerCancel.bind(this));
		olVisualizationLayers.addEventListener("keydown", this.#onKeyDown.bind(this));
	}

	addEventListener<K extends keyof LayersViewEventMap>(type: K, listener: (this: LayersView, event: LayersViewEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof LayersViewEventMap>(type: K, listener: (this: LayersView, event: LayersViewEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		return super.removeEventListener(type, listener, options);
	}

	#findRow(event: Event): HTMLLIElement | undefined {
		return event.composedPath().find(node => node instanceof HTMLLIElement);
	}

	#findHandle(event: Event): HTMLElement | undefined {
		return event.composedPath().find((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains("handle"));
	}

	#readDirection(code: string): number {
		switch (code) {
		case "ArrowUp": return -1;
		case "ArrowDown": return 1;
		default: return 0;
		}
	}

	#readRows(): HTMLLIElement[] {
		return Array.from(this.#olVisualizationLayers.getElements(HTMLLIElement, ":scope > li:not([data-pinned])"));
	}

	#readFocusedName(): string | null {
		const { activeElement } = document;
		if (!(activeElement instanceof HTMLElement)) return null;
		if (!this.#olVisualizationLayers.contains(activeElement)) return null;
		if (!activeElement.classList.contains("handle")) return null;
		const row = activeElement.closest("li");
		if (row === null) return null;
		const { name } = row.dataset;
		if (name === undefined) return null;
		return name;
	}

	#toStorage(reorder: Reorder, count: number): Reorder {
		return new Reorder(count - 1 - reorder.from, count - 1 - reorder.to);
	}

	#buildRow(settings: LayerSettings, isPinned: boolean): HTMLLIElement {
		const row = document.createElement("li");
		row.classList.add("rounded", "depth", "flex", "alt-center");
		row.dataset["name"] = settings.name;
		if (isPinned) row.dataset["pinned"] = String.empty;

		if (isPinned) DOMBuilder.newPin(row);
		else DOMBuilder.newHandle(row);

		const divContent = row.appendChild(document.createElement("div"));
		divContent.classList.add("content", "flex", "column", "with-gap", "with-padding");
		DOMBuilder.newTitle(divContent, settings.name);

		const divControls = divContent.appendChild(document.createElement("div"));
		divControls.classList.add("controls", "flex", "alt-center", "with-gap");

		const inputOpacity = divControls.appendChild(document.createElement("input"));
		inputOpacity.type = "range";
		inputOpacity.min = String(0);
		inputOpacity.max = String(1);
		inputOpacity.step = String(0.01);
		inputOpacity.value = String(settings.opacity);
		inputOpacity.title = "Opacity";
		inputOpacity.classList.add("layer", "rounded");
		inputOpacity.addEventListener("input", event => {
			settings.opacity = Number(inputOpacity.value);
			this.dispatchEvent(new CustomEvent("adjust", { detail: settings }));
		});

		const selectBlend = divControls.appendChild(document.createElement("select"));
		selectBlend.title = "Blend mode";
		selectBlend.classList.add("layer", "rounded", "with-padding");
		for (const [name, value] of Object.entries(Blend)) {
			const option = selectBlend.appendChild(document.createElement("option"));
			option.value = value;
			option.innerText = name;
		}
		selectBlend.value = settings.blend;
		selectBlend.addEventListener("change", event => {
			settings.blend = ReferenceError.suppress(Object.values(Blend).find(candidate => candidate === selectBlend.value), `Unknown blend '${selectBlend.value}'`);
			this.dispatchEvent(new CustomEvent("adjust", { detail: settings }));
		});

		return row;
	}

	#buildBackgroundRow(settings: BackgroundSettings): HTMLLIElement {
		const row = this.#buildRow(settings, true);
		const divContent = row.getElement(HTMLDivElement, "div.content");

		const divImage = divContent.appendChild(document.createElement("div"));
		divImage.classList.add("controls", "flex", "alt-center", "with-gap");

		const spanImage = divImage.appendChild(document.createElement("span"));
		spanImage.classList.add("title", "fittable");
		spanImage.innerText = "No image";
		if (settings.image !== null) spanImage.innerText = settings.image;

		const inputImage = divImage.appendChild(document.createElement("input"));
		inputImage.type = "file";
		inputImage.accept = "image/*";
		inputImage.hidden = true;
		inputImage.addEventListener("change", event => {
			const { files } = inputImage;
			if (files === null) return;
			const file = files.item(0);
			inputImage.value = String.empty;
			if (file === null) return;
			this.dispatchEvent(new CustomEvent("upload", { detail: file }));
		});

		const buttonUpload = divImage.appendChild(document.createElement("button"));
		buttonUpload.type = "button";
		buttonUpload.classList.add("layer", "rounded", "with-padding");
		buttonUpload.innerText = "Upload";
		buttonUpload.addEventListener("click", event => inputImage.click());

		if (settings.hasImage) {
			const buttonRemove = divImage.appendChild(document.createElement("button"));
			buttonRemove.type = "button";
			buttonRemove.classList.add("layer", "rounded", "with-padding");
			buttonRemove.innerText = "Remove";
			buttonRemove.addEventListener("click", event => this.dispatchEvent(new Event("remove")));

			const selectFit = divImage.appendChild(document.createElement("select"));
			selectFit.title = "Fit";
			selectFit.classList.add("layer", "rounded", "with-padding");
			for (const [name, value] of Object.entries(BackgroundFit)) {
				const option = selectFit.appendChild(document.createElement("option"));
				option.value = value;
				option.innerText = name;
			}
			selectFit.value = settings.fit;
			selectFit.addEventListener("change", event => {
				settings.fit = ReferenceError.suppress(Object.values(BackgroundFit).find(candidate => candidate === selectFit.value), `Unknown fit '${selectFit.value}'`);
				this.dispatchEvent(new CustomEvent("adjust", { detail: settings }));
			});
		}

		const spanMessage = divContent.appendChild(document.createElement("span"));
		spanMessage.classList.add("message", "alert");
		spanMessage.hidden = true;

		return row;
	}

	#onPointerDown(event: PointerEvent): void {
		const handle = this.#findHandle(event);
		if (handle === undefined) return;
		const row = this.#findRow(event);
		if (row === undefined) return;
		event.stopPropagation();
		handle.setPointerCapture(event.pointerId);
		this.#drag = new TrackDrag(row, this.#readRows(), event.clientY);
	}

	#onPointerMove(event: PointerEvent): void {
		if (this.#drag === null) return;
		this.#drag.track(event.clientY);
	}

	#onPointerUp(event: PointerEvent): void {
		if (this.#drag === null) return;
		const reorder = this.#drag.commit();
		this.#drag = null;
		if (!reorder.isEffective) return;
		this.dispatchEvent(new CustomEvent("reorder", { detail: this.#toStorage(reorder, this.#readRows().length) }));
	}

	#onPointerCancel(event: PointerEvent): void {
		if (this.#drag === null) return;
		this.#drag.cancel();
		this.#drag = null;
	}

	#onKeyDown(event: KeyboardEvent): void {
		const step = this.#readDirection(event.code);
		if (step === 0) return;
		if (this.#findHandle(event) === undefined) return;
		const row = this.#findRow(event);
		if (row === undefined) return;
		const rows = this.#readRows();
		const from = rows.indexOf(row);
		const to = (from + step).clamp(0, rows.length - 1);
		event.preventDefault();
		const reorder = new Reorder(from, to);
		if (!reorder.isEffective) return;
		this.dispatchEvent(new CustomEvent("reorder", { detail: this.#toStorage(reorder, rows.length) }));
	}

	showMessage(text: string): void {
		const spanMessage = this.#olVisualizationLayers.getElement(HTMLElement, "li[data-name=\"Background\"] span.message");
		spanMessage.innerText = text;
		spanMessage.hidden = false;
	}

	render(lyrics: LayerSettings, layers: readonly LayerSettings[], background: BackgroundSettings): void {
		const olVisualizationLayers = this.#olVisualizationLayers;
		const focused = this.#readFocusedName();

		olVisualizationLayers.replaceChildren();
		olVisualizationLayers.appendChild(this.#buildRow(lyrics, true));
		for (let index = layers.length - 1; index >= 0; index--) olVisualizationLayers.appendChild(this.#buildRow(layers[index], false));
		olVisualizationLayers.appendChild(this.#buildBackgroundRow(background));

		if (focused === null) return;
		const row = this.#readRows().find(candidate => candidate.dataset["name"] === focused);
		if (row === undefined) return;
		row.getElement(HTMLElement, "span.handle").focus({ preventScroll: true });
	}
}
//#endregion
