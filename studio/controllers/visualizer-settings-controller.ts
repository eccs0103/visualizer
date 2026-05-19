"use strict";

import "adaptive-extender/web";
import { Controller, ArchiveRepository } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";

//#region Visualizer settings controller
export class VisualizerSettingsController extends Controller<[ArchiveRepository<typeof Settings>, Visualizer, HTMLDialogElement, HTMLSelectElement]> {
	#visualizer: Visualizer;
	#repository: ArchiveRepository<typeof Settings>;
	#selectVisualizerVisualization: HTMLSelectElement;
	#inputVisualizerRate: HTMLInputElement;
	#inputAutocorrectToggle: HTMLInputElement;
	#inputVisualizationQuality: HTMLInputElement;
	#inputVisualizationSmoothing: HTMLInputElement;
	#inputVisualizationFocus: HTMLInputElement;
	#inputVisualizationSpread: HTMLInputElement;

	#applyVisualization(): void {
		const settings = this.#repository.content;
		const visualizer = this.#visualizer;
		visualizer.visualization = this.#selectVisualizerVisualization.value;
		settings.visualizer.visualization = visualizer.visualization;
		visualizer.quality = settings.visualizer.configuration.quality;
		this.#inputVisualizationQuality.value = String(visualizer.quality);
		visualizer.smoothing = settings.visualizer.configuration.smoothing;
		this.#inputVisualizationSmoothing.value = String(visualizer.smoothing);
		visualizer.focus = settings.visualizer.configuration.focus;
		this.#inputVisualizationFocus.value = String(visualizer.focus);
		visualizer.spread = settings.visualizer.configuration.spread;
		this.#inputVisualizationSpread.value = String(visualizer.spread);
	}

	async run(repository: ArchiveRepository<typeof Settings>, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement, selectVisualizerVisualization: HTMLSelectElement): Promise<void> {
		this.#visualizer = visualizer;
		this.#repository = repository;
		this.#selectVisualizerVisualization = selectVisualizerVisualization;

		const inputVisualizerRate = this.#inputVisualizerRate = dialogConfigurator.getElement(HTMLInputElement, "input#visualizer-rate");
		const inputAutocorrectToggle = this.#inputAutocorrectToggle = dialogConfigurator.getElement(HTMLInputElement, "input#autocorrect-toggle");
		const inputVisualizationQuality = this.#inputVisualizationQuality = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-quality");
		const inputVisualizationSmoothing = this.#inputVisualizationSmoothing = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-smoothing");
		const inputVisualizationFocus = this.#inputVisualizationFocus = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-focus");
		const inputVisualizationSpread = this.#inputVisualizationSpread = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-spread");

		const settings = repository.content;

		for (const name of Visualizer.visualizations) {
			const option = selectVisualizerVisualization.appendChild(document.createElement("option"));
			option.value = name;
			option.innerText = name;
		}
		selectVisualizerVisualization.value = visualizer.visualization;
		selectVisualizerVisualization.addEventListener("change", event => this.#applyVisualization());

		inputVisualizerRate.value = String(visualizer.rate);
		inputVisualizerRate.addEventListener("change", async (event) => {
			visualizer.rate = Number(inputVisualizerRate.value);
			inputVisualizerRate.value = String(visualizer.rate);
			settings.visualizer.rate = visualizer.rate;
			await repository.save(500);
		});

		inputVisualizationQuality.value = String(visualizer.quality);
		inputVisualizationQuality.addEventListener("change", async (event) => {
			visualizer.quality = Number(inputVisualizationQuality.value);
			inputVisualizationQuality.value = String(visualizer.quality);
			settings.visualizer.configuration.quality = visualizer.quality;
			await repository.save(500);
		});

		inputVisualizationSmoothing.value = String(visualizer.smoothing);
		inputVisualizationSmoothing.addEventListener("input", (event) => {
			visualizer.smoothing = Number(inputVisualizationSmoothing.value);
		});
		inputVisualizationSmoothing.addEventListener("change", async (event) => {
			settings.visualizer.configuration.smoothing = visualizer.smoothing;
			await repository.save(500);
		});

		inputVisualizationFocus.value = String(visualizer.focus);
		inputVisualizationFocus.disabled = visualizer.autocorrect;
		inputVisualizationFocus.addEventListener("input", (event) => {
			visualizer.focus = Number(inputVisualizationFocus.value);
		});
		inputVisualizationFocus.addEventListener("change", async (event) => {
			settings.visualizer.configuration.focus = visualizer.focus;
			await repository.save(500);
		});

		inputVisualizationSpread.value = String(visualizer.spread);
		inputVisualizationSpread.disabled = visualizer.autocorrect;
		inputVisualizationSpread.addEventListener("input", (event) => {
			visualizer.spread = Number(inputVisualizationSpread.value);
		});
		inputVisualizationSpread.addEventListener("change", async (event) => {
			settings.visualizer.configuration.spread = visualizer.spread;
			await repository.save(500);
		});

		visualizer.addEventListener("update", async (event) => {
			if (!visualizer.autocorrect) return;
			inputVisualizationFocus.value = String(visualizer.focus);
			settings.visualizer.configuration.focus = visualizer.focus;
			inputVisualizationSpread.value = String(visualizer.spread);
			settings.visualizer.configuration.spread = visualizer.spread;
		});

		inputAutocorrectToggle.checked = visualizer.autocorrect;
		inputAutocorrectToggle.addEventListener("input", (event) => {
			visualizer.autocorrect = inputAutocorrectToggle.checked;
			inputVisualizationFocus.disabled = visualizer.autocorrect;
			inputVisualizationSpread.disabled = visualizer.autocorrect;
		});
		inputAutocorrectToggle.addEventListener("change", async (event) => {
			settings.visualizer.autocorrect = visualizer.autocorrect;
			await repository.save(500);
		});

		window.addEventListener("keydown", (event) => {
			if (!event.shiftKey || event.code !== "Tab") return;
			event.preventDefault();
			selectVisualizerVisualization.selectedIndex = (selectVisualizerVisualization.selectedIndex + 1) % selectVisualizerVisualization.length;
			selectVisualizerVisualization.dispatchEvent(new Event("change"));
		});
	}
}
//#endregion
