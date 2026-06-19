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
		const { configuration } = settings;
		visualizer.quality = configuration.quality;
		this.#inputVisualizationQuality.value = String(visualizer.quality);
		visualizer.smoothing = configuration.smoothing;
		this.#inputVisualizationSmoothing.value = String(visualizer.smoothing);
		visualizer.focus = configuration.focus;
		this.#inputVisualizationFocus.value = String(visualizer.focus);
		visualizer.spread = configuration.spread;
		this.#inputVisualizationSpread.value = String(visualizer.spread);
		visualizer.boost = configuration.boost ?? 1;
		this.#inputVisualizationBoost.value = String(visualizer.boost);
		visualizer.tilt = configuration.tilt ?? 0;
		this.#inputVisualizationTilt.value = String(visualizer.tilt);
		visualizer.punch = configuration.punch ?? 0;
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

		inputVisualizerRate.min = String(Visualizer.minRate);
		inputVisualizerRate.max = String(Visualizer.maxRate);
		inputVisualizerRate.step = String(30);
		inputVisualizerRate.value = String(visualizer.rate);
		inputVisualizerRate.addEventListener("change", async (event) => {
			visualizer.rate = Number(inputVisualizerRate.value);
			inputVisualizerRate.value = String(visualizer.rate);
			settings.rate = visualizer.rate;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationQuality.min = String(Visualizer.minQuality);
		inputVisualizationQuality.max = String(Visualizer.maxQuality);
		inputVisualizationQuality.step = String(1);
		inputVisualizationQuality.value = String(visualizer.quality);
		inputVisualizationQuality.addEventListener("change", async (event) => {
			visualizer.quality = Number(inputVisualizationQuality.value);
			inputVisualizationQuality.value = String(visualizer.quality);
			settings.configuration.quality = visualizer.quality;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationSmoothing.min = String(Visualizer.minSmoothing);
		inputVisualizationSmoothing.max = String(Visualizer.maxSmoothing);
		inputVisualizationSmoothing.step = String(0.1);
		inputVisualizationSmoothing.value = String(visualizer.smoothing);
		inputVisualizationSmoothing.addEventListener("input", (event) => {
			visualizer.smoothing = Number(inputVisualizationSmoothing.value);
		});
		inputVisualizationSmoothing.addEventListener("change", async (event) => {
			settings.configuration.smoothing = visualizer.smoothing;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationFocus.min = String(-100);
		inputVisualizationFocus.max = String(-20);
		inputVisualizationFocus.step = String(1);
		inputVisualizationFocus.value = String(visualizer.focus);
		inputVisualizationFocus.disabled = visualizer.autoCorrect;
		inputVisualizationFocus.addEventListener("input", (event) => {
			visualizer.focus = Number(inputVisualizationFocus.value);
		});
		inputVisualizationFocus.addEventListener("change", async (event) => {
			settings.configuration.focus = visualizer.focus;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationSpread.min = String(1);
		inputVisualizationSpread.max = String(59);
		inputVisualizationSpread.step = String(1);
		inputVisualizationSpread.value = String(visualizer.spread);
		inputVisualizationSpread.disabled = visualizer.autoCorrect;
		inputVisualizationSpread.addEventListener("input", (event) => {
			visualizer.spread = Number(inputVisualizationSpread.value);
		});
		inputVisualizationSpread.addEventListener("change", async (event) => {
			settings.configuration.spread = visualizer.spread;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationBoost.min = String(Visualizer.minBoost);
		inputVisualizationBoost.max = String(Visualizer.maxBoost);
		inputVisualizationBoost.step = String(0.05);
		inputVisualizationBoost.value = String(settings.configuration.boost);
		visualizer.boost = settings.configuration.boost ?? 1;
		inputVisualizationBoost.disabled = visualizer.autoCorrect;
		inputVisualizationBoost.addEventListener("input", (event) => {
			visualizer.boost = Number(inputVisualizationBoost.value);
		});
		inputVisualizationBoost.addEventListener("change", async (event) => {
			settings.configuration.boost = visualizer.boost;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationTilt.min = String(Visualizer.minTilt);
		inputVisualizationTilt.max = String(Visualizer.maxTilt);
		inputVisualizationTilt.step = String(0.5);
		inputVisualizationTilt.value = String(settings.configuration.tilt);
		visualizer.tilt = settings.configuration.tilt ?? 0;
		inputVisualizationTilt.disabled = visualizer.autoCorrect;
		inputVisualizationTilt.addEventListener("input", (event) => {
			visualizer.tilt = Number(inputVisualizationTilt.value);
		});
		inputVisualizationTilt.addEventListener("change", async (event) => {
			settings.configuration.tilt = visualizer.tilt;
			try { await repository.save(500); } catch { }
		});

		inputVisualizationPunch.min = String(Visualizer.minPunch);
		inputVisualizationPunch.max = String(Visualizer.maxPunch);
		inputVisualizationPunch.step = String(0.05);
		inputVisualizationPunch.value = String(settings.configuration.punch);
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
