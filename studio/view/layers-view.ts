"use strict";

import "adaptive-extender/web";
import { Blend } from "../models/blend.js";
import { BackgroundEffectKind, BackgroundFit, type BackgroundSettings } from "../models/background-settings.js";
import { type LayerSettings } from "../models/layer-settings.js";
import { Reorder } from "../models/playlist.js";
import { DOMBuilder } from "./dom-builder.js";
import { TrackDrag } from "./track-drag.js";

type Listener<T> = (value: T) => void;

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

	#adjust(settings: LayerSettings): void {
		this.dispatchEvent(new CustomEvent("adjust", { detail: settings }));
	}

	#buildRange(option: HTMLElement, title: string, value: number, onInput: Listener<number>): HTMLInputElement {
		const inputRange = option.appendChild(document.createElement("input"));
		inputRange.type = "range";
		inputRange.min = String(0);
		inputRange.max = String(1);
		inputRange.step = String(0.01);
		inputRange.value = String(value);
		inputRange.title = title;
		inputRange.classList.add("value", "depth", "rounded");
		inputRange.addEventListener("input", event => onInput(Number(inputRange.value)));
		return inputRange;
	}

	#buildSelect<T extends string>(option: HTMLElement, title: string, reference: Readonly<Record<string, T>>, value: T, onChange: Listener<T>): HTMLSelectElement {
		const selectChoice = option.appendChild(document.createElement("select"));
		selectChoice.title = title;
		selectChoice.classList.add("value", "depth", "rounded", "with-padding");
		for (const [name, item] of Object.entries(reference)) {
			const choice = selectChoice.appendChild(document.createElement("option"));
			choice.value = item;
			choice.innerText = name.toTitleCase();
		}
		selectChoice.value = value;
		selectChoice.addEventListener("change", event => onChange(ReferenceError.suppress(Object.values(reference).find(candidate => candidate === selectChoice.value), `Unknown option '${selectChoice.value}'`)));
		return selectChoice;
	}

	#buildRow(settings: LayerSettings, isPinned: boolean): HTMLLIElement {
		const row = document.createElement("li");
		row.classList.add("rounded", "depth", "flex", "alt-center");
		row.dataset["name"] = settings.name;
		if (isPinned) row.dataset["pinned"] = String.empty;

		if (isPinned) DOMBuilder.newPin(row);
		else DOMBuilder.newHandle(row);

		const group = DOMBuilder.newGroup(row, settings.name);

		const optionOpacity = DOMBuilder.newOption(group, "Opacity", "How visible the layer is. 0 hides it completely.");
		this.#buildRange(optionOpacity, "Opacity", settings.opacity, value => {
			settings.opacity = value;
			this.#adjust(settings);
		});

		const optionBlend = DOMBuilder.newOption(group, "Blend mode", "How the layer mixes with the layers below it.");
		this.#buildSelect(optionBlend, "Blend mode", Blend, settings.blend, value => {
			settings.blend = value;
			this.#adjust(settings);
		});

		return row;
	}

	#buildBackgroundRow(settings: BackgroundSettings): HTMLLIElement {
		const row = this.#buildRow(settings, true);
		const group = row.getElement(HTMLElement, "section.option");

		let definition = "No image, the theme colour is used.";
		if (settings.image !== null) definition = settings.image;
		const optionImage = DOMBuilder.newOption(group, "Image", definition);
		const divImage = optionImage.appendChild(document.createElement("div"));
		divImage.classList.add("value", "flex", "with-gap");

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
		buttonUpload.classList.add("depth", "rounded", "with-padding");
		buttonUpload.innerText = "Upload";
		buttonUpload.addEventListener("click", event => inputImage.click());

		if (settings.hasImage) {
			const buttonRemove = divImage.appendChild(document.createElement("button"));
			buttonRemove.type = "button";
			buttonRemove.classList.add("depth", "rounded", "with-padding");
			buttonRemove.innerText = "Remove";
			buttonRemove.addEventListener("click", event => this.dispatchEvent(new Event("remove")));

			const optionFit = DOMBuilder.newOption(group, "Fit", "How the image fills the canvas. Cover crops the edges, contain shows the whole image, stretch distorts it to fit.");
			this.#buildSelect(optionFit, "Fit", BackgroundFit, settings.fit, value => {
				settings.fit = value;
				this.#adjust(settings);
			});

			const optionEffect = DOMBuilder.newOption(group, "Effect", "Moves the image with the music. Shake and parallax follow the visualization's own motion, pulse follows the beat.");
			this.#buildSelect(optionEffect, "Effect", BackgroundEffectKind, settings.effect, value => {
				settings.effect = value;
				inputIntensity.disabled = value === BackgroundEffectKind.none;
				this.#adjust(settings);
			});

			const optionIntensity = DOMBuilder.newOption(optionEffect, "Intensity", "How strong the effect is.");
			const inputIntensity = this.#buildRange(optionIntensity, "Intensity", settings.intensity, value => {
				settings.intensity = value;
				this.#adjust(settings);
			});
			inputIntensity.disabled = settings.effect === BackgroundEffectKind.none;
		}

		const spanMessage = group.appendChild(document.createElement("span"));
		spanMessage.classList.add("message", "alert", "grid-line");
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
