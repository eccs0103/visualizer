"use strict";

import "adaptive-extender/web";
import { Controller, BufferedCell } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";
import { Audioset } from "../models/audioset.js";
import { Registry } from "../services/visualization-registry.js";

//#region Visualizer settings controller
export class VisualizerSettingsController extends Controller<[BufferedCell<typeof Settings>, Visualizer, HTMLDialogElement, HTMLSelectElement]> {
	#visualizer: Visualizer;
	#cell: BufferedCell<typeof Settings>;
	#selectVisualizerVisualization: HTMLSelectElement;
	#inputVisualizerRate: HTMLInputElement;
	#inputVisualizationQuality: HTMLInputElement;
	#inputVisualizationSmoothing: HTMLInputElement;
	#inputVisualizationFocus: HTMLInputElement;
	#inputVisualizationSpread: HTMLInputElement;
	#inputVisualizationBoost: HTMLInputElement;
	#inputVisualizationTilt: HTMLInputElement;
	#inputVisualizationPunch: HTMLInputElement;

	#readDirection(code: string): number {
		switch (code) {
		case "ArrowUp": return -1;
		case "ArrowDown": return 1;
		default: return 0;
		}
	}

	#cycleVisualization(step: number): void {
		const select = this.#selectVisualizerVisualization;
		select.selectedIndex = (select.selectedIndex + step).mod(select.length);
		select.dispatchEvent(new Event("change"));
	}

	#refreshKnobs(): void {
		const { audioset } = this.#visualizer;
		this.#inputVisualizationQuality.value = String(audioset.quality);
		this.#inputVisualizationSmoothing.value = String(audioset.smoothing);
		this.#inputVisualizationFocus.value = String(audioset.focus);
		this.#inputVisualizationSpread.value = String(audioset.spread);
		this.#inputVisualizationBoost.value = String(audioset.boost);
		this.#inputVisualizationTilt.value = String(audioset.tilt);
		this.#inputVisualizationPunch.value = String(audioset.punch);
	}

	#applyVisualization(): void {
		const settings = this.#cell.content;
		const visualizer = this.#visualizer;
		visualizer.visualization = this.#selectVisualizerVisualization.value;
		settings.visualization = visualizer.visualization;
		visualizer.audioset.apply(settings.configuration);
		this.#refreshKnobs();
	}

	async run(cell: BufferedCell<typeof Settings>, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement, selectVisualizerVisualization: HTMLSelectElement): Promise<void> {
		this.#visualizer = visualizer;
		this.#cell = cell;
		this.#selectVisualizerVisualization = selectVisualizerVisualization;

		const inputVisualizerRate = this.#inputVisualizerRate = dialogConfigurator.getElement(HTMLInputElement, "input#visualizer-rate");
		const inputVisualizationQuality = this.#inputVisualizationQuality = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-quality");
		const inputVisualizationSmoothing = this.#inputVisualizationSmoothing = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-smoothing");
		const inputVisualizationFocus = this.#inputVisualizationFocus = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-focus");
		const inputVisualizationSpread = this.#inputVisualizationSpread = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-spread");
		const inputVisualizationBoost = this.#inputVisualizationBoost = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-boost");
		const inputVisualizationTilt = this.#inputVisualizationTilt = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-tilt");
		const inputVisualizationPunch = this.#inputVisualizationPunch = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-punch");

		const settings = cell.content;
		const { audioset } = visualizer;

		for (const name of Registry.names()) {
			const option = selectVisualizerVisualization.appendChild(document.createElement("option"));
			option.value = name;
			option.innerText = name;
		}
		selectVisualizerVisualization.value = visualizer.visualization;
		selectVisualizerVisualization.addEventListener("change", async (event) => {
			this.#applyVisualization();
			await cell.save(500);
		});

		inputVisualizerRate.min = String(Visualizer.minRate);
		inputVisualizerRate.max = String(Visualizer.maxRate);
		inputVisualizerRate.step = String(30);
		inputVisualizerRate.value = String(visualizer.rate);
		inputVisualizerRate.addEventListener("change", async (event) => {
			visualizer.rate = Number(inputVisualizerRate.value);
			inputVisualizerRate.value = String(visualizer.rate);
			settings.rate = visualizer.rate;
			await cell.save(500);
		});

		inputVisualizationQuality.min = String(Audioset.minQuality);
		inputVisualizationQuality.max = String(Audioset.maxQuality);
		inputVisualizationQuality.step = String(1);
		inputVisualizationQuality.addEventListener("change", async (event) => {
			audioset.quality = Number(inputVisualizationQuality.value);
			inputVisualizationQuality.value = String(audioset.quality);
			settings.configuration.quality = audioset.quality;
			await cell.save(500);
		});

		inputVisualizationSmoothing.min = String(Audioset.minSmoothing);
		inputVisualizationSmoothing.max = String(Audioset.maxSmoothing);
		inputVisualizationSmoothing.step = String(0.1);
		inputVisualizationSmoothing.addEventListener("input", (event) => {
			audioset.smoothing = Number(inputVisualizationSmoothing.value);
		});
		inputVisualizationSmoothing.addEventListener("change", async (event) => {
			settings.configuration.smoothing = audioset.smoothing;
			await cell.save(500);
		});

		inputVisualizationFocus.min = String(Audioset.minFocus);
		inputVisualizationFocus.max = String(Audioset.maxFocus);
		inputVisualizationFocus.step = String(1);
		inputVisualizationFocus.addEventListener("input", (event) => {
			audioset.focus = Number(inputVisualizationFocus.value);
		});
		inputVisualizationFocus.addEventListener("change", async (event) => {
			settings.configuration.focus = audioset.focus;
			await cell.save(500);
		});

		inputVisualizationSpread.min = String(Audioset.minSpread);
		inputVisualizationSpread.max = String(Audioset.maxSpread);
		inputVisualizationSpread.step = String(1);
		inputVisualizationSpread.addEventListener("input", (event) => {
			audioset.spread = Number(inputVisualizationSpread.value);
		});
		inputVisualizationSpread.addEventListener("change", async (event) => {
			settings.configuration.spread = audioset.spread;
			await cell.save(500);
		});

		inputVisualizationBoost.min = String(Audioset.minBoost);
		inputVisualizationBoost.max = String(Audioset.maxBoost);
		inputVisualizationBoost.step = String(0.05);
		inputVisualizationBoost.addEventListener("input", (event) => {
			audioset.boost = Number(inputVisualizationBoost.value);
		});
		inputVisualizationBoost.addEventListener("change", async (event) => {
			settings.configuration.boost = audioset.boost;
			await cell.save(500);
		});

		inputVisualizationTilt.min = String(Audioset.minTilt);
		inputVisualizationTilt.max = String(Audioset.maxTilt);
		inputVisualizationTilt.step = String(0.5);
		inputVisualizationTilt.addEventListener("input", (event) => {
			audioset.tilt = Number(inputVisualizationTilt.value);
		});
		inputVisualizationTilt.addEventListener("change", async (event) => {
			settings.configuration.tilt = audioset.tilt;
			await cell.save(500);
		});

		inputVisualizationPunch.min = String(Audioset.minPunch);
		inputVisualizationPunch.max = String(Audioset.maxPunch);
		inputVisualizationPunch.step = String(0.05);
		inputVisualizationPunch.addEventListener("input", (event) => {
			audioset.punch = Number(inputVisualizationPunch.value);
		});
		inputVisualizationPunch.addEventListener("change", async (event) => {
			settings.configuration.punch = audioset.punch;
			await cell.save(500);
		});

		this.#refreshKnobs();

		window.addEventListener("keydown", (event) => {
			const step = this.#readDirection(event.code);
			if (step === 0) return;
			if (event.repeat) return;
			const { activeElement } = document;
			if (activeElement instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(activeElement.tagName)) return;
			if (document.querySelector("dialog[open]") !== null) return;
			event.preventDefault();
			this.#cycleVisualization(step);
		});
	}
}
//#endregion
