"use strict";

import "adaptive-extender/web";
import { Controller, ArchiveRepository } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";

//#region Visualizer settings controller
export class VisualizerSettingsController extends Controller<[repository: ArchiveRepository<typeof Settings>, visualizer: Visualizer, dialog: HTMLDialogElement, typeSelect: HTMLSelectElement]> {
	#visualizer: Visualizer;
	#repository: ArchiveRepository<typeof Settings>;
	#typeSelect: HTMLSelectElement;
	#rateField: HTMLInputElement;
	#autoToggle: HTMLInputElement;
	#quality: HTMLInputElement;
	#smoothing: HTMLInputElement;
	#focus: HTMLInputElement;
	#spread: HTMLInputElement;

	#applyVisualization(): void {
		const settings = this.#repository.content;
		const visualizer = this.#visualizer;
		visualizer.visualization = this.#typeSelect.value;
		settings.visualizer.visualization = visualizer.visualization;
		visualizer.quality = settings.visualizer.configuration.quality;
		this.#quality.value = String(visualizer.quality);
		visualizer.smoothing = settings.visualizer.configuration.smoothing;
		this.#smoothing.value = String(visualizer.smoothing);
		visualizer.focus = settings.visualizer.configuration.focus;
		this.#focus.value = String(visualizer.focus);
		visualizer.spread = settings.visualizer.configuration.spread;
		this.#spread.value = String(visualizer.spread);
	}

	async run(repository: ArchiveRepository<typeof Settings>, visualizer: Visualizer, dialog: HTMLDialogElement, typeSelect: HTMLSelectElement): Promise<void> {
		this.#visualizer = visualizer;
		this.#repository = repository;
		this.#typeSelect = typeSelect;

		const rateField = this.#rateField = dialog.getElement(HTMLInputElement, "input#visualizer-rate");
		const autoToggle = this.#autoToggle = dialog.getElement(HTMLInputElement, "input#autocorrect-toggle");
		const quality = this.#quality = dialog.getElement(HTMLInputElement, "input#visualization-quality");
		const smoothing = this.#smoothing = dialog.getElement(HTMLInputElement, "input#visualization-smoothing");
		const focus = this.#focus = dialog.getElement(HTMLInputElement, "input#visualization-focus");
		const spread = this.#spread = dialog.getElement(HTMLInputElement, "input#visualization-spread");

		const settings = repository.content;

		for (const name of Visualizer.visualizations) {
			const option = typeSelect.appendChild(document.createElement("option"));
			option.value = name;
			option.innerText = name;
		}
		typeSelect.value = visualizer.visualization;
		typeSelect.addEventListener("change", event => this.#applyVisualization());

		rateField.value = String(visualizer.rate);
		rateField.addEventListener("change", async (event) => {
			visualizer.rate = Number(rateField.value);
			rateField.value = String(visualizer.rate);
			settings.visualizer.rate = visualizer.rate;
			await repository.save(500);
		});

		quality.value = String(visualizer.quality);
		quality.addEventListener("change", async (event) => {
			visualizer.quality = Number(quality.value);
			quality.value = String(visualizer.quality);
			settings.visualizer.configuration.quality = visualizer.quality;
			await repository.save(500);
		});

		smoothing.value = String(visualizer.smoothing);
		smoothing.addEventListener("input", (event) => {
			visualizer.smoothing = Number(smoothing.value);
		});
		smoothing.addEventListener("change", async (event) => {
			settings.visualizer.configuration.smoothing = visualizer.smoothing;
			await repository.save(500);
		});

		focus.value = String(visualizer.focus);
		focus.disabled = visualizer.autocorrect;
		focus.addEventListener("input", (event) => {
			visualizer.focus = Number(focus.value);
		});
		focus.addEventListener("change", async (event) => {
			settings.visualizer.configuration.focus = visualizer.focus;
			await repository.save(500);
		});

		spread.value = String(visualizer.spread);
		spread.disabled = visualizer.autocorrect;
		spread.addEventListener("input", (event) => {
			visualizer.spread = Number(spread.value);
		});
		spread.addEventListener("change", async (event) => {
			settings.visualizer.configuration.spread = visualizer.spread;
			await repository.save(500);
		});

		visualizer.addEventListener("update", async (event) => {
			if (!visualizer.autocorrect) return;
			focus.value = String(visualizer.focus);
			settings.visualizer.configuration.focus = visualizer.focus;
			spread.value = String(visualizer.spread);
			settings.visualizer.configuration.spread = visualizer.spread;
		});

		autoToggle.checked = visualizer.autocorrect;
		autoToggle.addEventListener("input", (event) => {
			visualizer.autocorrect = autoToggle.checked;
			focus.disabled = visualizer.autocorrect;
			spread.disabled = visualizer.autocorrect;
		});
		autoToggle.addEventListener("change", async (event) => {
			settings.visualizer.autocorrect = visualizer.autocorrect;
			await repository.save(500);
		});

		window.addEventListener("keydown", (event) => {
			if (!event.shiftKey || event.code !== "Tab") return;
			event.preventDefault();
			typeSelect.selectedIndex = (typeSelect.selectedIndex + 1) % typeSelect.length;
			typeSelect.dispatchEvent(new Event("change"));
		});
	}
}
//#endregion
