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
		settings.visualization = visualizer.visualization;
		visualizer.quality = settings.configuration.quality;
		this.#inputVisualizationQuality.value = String(visualizer.quality);
		visualizer.smoothing = settings.configuration.smoothing;
		this.#inputVisualizationSmoothing.value = String(visualizer.smoothing);
		visualizer.focus = settings.configuration.focus;
		this.#inputVisualizationFocus.value = String(visualizer.focus);
		visualizer.spread = settings.configuration.spread;
		this.#inputVisualizationSpread.value = String(visualizer.spread);
	}

	async run(repository: ArchiveRepository<typeof Settings>, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement, selectVisualizerVisualization: HTMLSelectElement): Promise<void> {
		this.#visualizer = visualizer;
		this.#repository = repository;
		this.#selectVisualizerVisualization = selectVisualizerVisualization;

		const inputVisualizerRate = this.#inputVisualizerRate = dialogConfigurator.getElement(HTMLInputElement, "input#visualizer-rate");
		const inputAutocorrectToggle = this.#inputAutocorrectToggle = dialogConfigurator.getElement(HTMLInputElement, "input#auto-correct-toggle");
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
			settings.rate = visualizer.rate;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationQuality.value = String(visualizer.quality);
		inputVisualizationQuality.addEventListener("change", async (event) => {
			visualizer.quality = Number(inputVisualizationQuality.value);
			inputVisualizationQuality.value = String(visualizer.quality);
			settings.configuration.quality = visualizer.quality;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationSmoothing.value = String(visualizer.smoothing);
		inputVisualizationSmoothing.addEventListener("input", (event) => {
			visualizer.smoothing = Number(inputVisualizationSmoothing.value);
		});
		inputVisualizationSmoothing.addEventListener("change", async (event) => {
			settings.configuration.smoothing = visualizer.smoothing;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationFocus.value = String(visualizer.focus);
		inputVisualizationFocus.disabled = visualizer.autoCorrect;
		inputVisualizationFocus.addEventListener("input", (event) => {
			visualizer.focus = Number(inputVisualizationFocus.value);
		});
		inputVisualizationFocus.addEventListener("change", async (event) => {
			settings.configuration.focus = visualizer.focus;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationSpread.value = String(visualizer.spread);
		inputVisualizationSpread.disabled = visualizer.autoCorrect;
		inputVisualizationSpread.addEventListener("input", (event) => {
			visualizer.spread = Number(inputVisualizationSpread.value);
		});
		inputVisualizationSpread.addEventListener("change", async (event) => {
			settings.configuration.spread = visualizer.spread;
			try { await repository.save(500); } catch { }
		});

		visualizer.addEventListener("update", async (event) => {
			if (!visualizer.autoCorrect) return;
			inputVisualizationFocus.value = String(visualizer.focus);
			settings.configuration.focus = visualizer.focus;
			inputVisualizationSpread.value = String(visualizer.spread);
			settings.configuration.spread = visualizer.spread;
		});

		inputAutocorrectToggle.checked = visualizer.autoCorrect;
		inputAutocorrectToggle.addEventListener("input", (event) => {
			visualizer.autoCorrect = inputAutocorrectToggle.checked;
			inputVisualizationFocus.disabled = visualizer.autoCorrect;
			inputVisualizationSpread.disabled = visualizer.autoCorrect;
		});
		inputAutocorrectToggle.addEventListener("change", async (event) => {
			settings.autoCorrect = visualizer.autoCorrect;
			try { await repository.save(500); } catch { }
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
