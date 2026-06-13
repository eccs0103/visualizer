"use strict";

import "adaptive-extender/web";
import { Controller, ArchiveRepository } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";
import { Registry } from "../services/visualization-registry.js";

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
	#inputVisualizationBoost: HTMLInputElement;
	#inputVisualizationTilt: HTMLInputElement;
	#inputVisualizationPunch: HTMLInputElement;

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
		visualizer.boost = settings.configuration.boost ?? 1;
		this.#inputVisualizationBoost.value = String(visualizer.boost);
		visualizer.tilt = settings.configuration.tilt ?? 0;
		this.#inputVisualizationTilt.value = String(visualizer.tilt);
		visualizer.punch = settings.configuration.punch ?? 0;
		this.#inputVisualizationPunch.value = String(visualizer.punch);
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
		const inputVisualizationBoost = this.#inputVisualizationBoost = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-boost");
		const inputVisualizationTilt = this.#inputVisualizationTilt = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-tilt");
		const inputVisualizationPunch = this.#inputVisualizationPunch = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-punch");

		const settings = repository.content;

		for (const name of Registry.names()) {
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

		inputVisualizationBoost.value = String(settings.configuration.boost ?? 1);
		visualizer.boost = settings.configuration.boost ?? 1;
		inputVisualizationBoost.disabled = visualizer.autoCorrect;
		inputVisualizationBoost.addEventListener("input", (event) => {
			visualizer.boost = Number(inputVisualizationBoost.value);
		});
		inputVisualizationBoost.addEventListener("change", async (event) => {
			settings.configuration.boost = visualizer.boost;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationTilt.value = String(settings.configuration.tilt ?? 0);
		visualizer.tilt = settings.configuration.tilt ?? 0;
		inputVisualizationTilt.disabled = visualizer.autoCorrect;
		inputVisualizationTilt.addEventListener("input", (event) => {
			visualizer.tilt = Number(inputVisualizationTilt.value);
		});
		inputVisualizationTilt.addEventListener("change", async (event) => {
			settings.configuration.tilt = visualizer.tilt;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationPunch.value = String(settings.configuration.punch ?? 0);
		visualizer.punch = settings.configuration.punch ?? 0;
		inputVisualizationPunch.disabled = visualizer.autoCorrect;
		inputVisualizationPunch.addEventListener("input", (event) => {
			visualizer.punch = Number(inputVisualizationPunch.value);
		});
		inputVisualizationPunch.addEventListener("change", async (event) => {
			settings.configuration.punch = visualizer.punch;
			try { await repository.save(500); } catch { }
		});

		visualizer.addEventListener("update", async (event) => {
			if (!visualizer.autoCorrect) return;
			inputVisualizationFocus.value = String(visualizer.focus);
			settings.configuration.focus = visualizer.focus;
			inputVisualizationSpread.value = String(visualizer.spread);
			settings.configuration.spread = visualizer.spread;
			inputVisualizationBoost.value = String(visualizer.boost);
			settings.configuration.boost = visualizer.boost;
			inputVisualizationTilt.value = String(visualizer.tilt);
			settings.configuration.tilt = visualizer.tilt;
			inputVisualizationPunch.value = String(visualizer.punch);
			settings.configuration.punch = visualizer.punch;
		});

		inputAutocorrectToggle.checked = visualizer.autoCorrect;
		inputAutocorrectToggle.addEventListener("input", (event) => {
			visualizer.autoCorrect = inputAutocorrectToggle.checked;
			inputVisualizationFocus.disabled = visualizer.autoCorrect;
			inputVisualizationSpread.disabled = visualizer.autoCorrect;
			inputVisualizationBoost.disabled = visualizer.autoCorrect;
			inputVisualizationTilt.disabled = visualizer.autoCorrect;
			inputVisualizationPunch.disabled = visualizer.autoCorrect;
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
