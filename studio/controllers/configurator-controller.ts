"use strict";

import "adaptive-extender/web";
import { Controller, BufferedCell } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";
import { VisualizerSettingsController } from "./visualizer-settings-controller.js";
import { AIController } from "./ai-controller.js";

//#region Configurator controller
export class ConfiguratorController extends Controller<[BufferedCell<typeof Settings>, Visualizer, HTMLDialogElement, HTMLButtonElement, HTMLSelectElement]> {
	#dialogConfigurator: HTMLDialogElement;

	async #setActivity(value: boolean): Promise<void> {
		const dialogConfigurator = this.#dialogConfigurator;
		const duration = 50;
		const fill: FillMode = "both";
		if (value) {
			dialogConfigurator.showModal();
			await dialogConfigurator.animate([{ opacity: "0", easing: "ease-in" }, { opacity: "1" }], { duration, fill }).finished;
		} else {
			await dialogConfigurator.animate([{ opacity: "1", easing: "ease-out" }, { opacity: "0" }], { duration, fill }).finished;
			dialogConfigurator.close();
		}
	}

	async run(cell: BufferedCell<typeof Settings>, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement, buttonOpenConfigurator: HTMLButtonElement, selectVisualizerVisualization: HTMLSelectElement): Promise<void> {
		this.#dialogConfigurator = dialogConfigurator;

		const buttonCloseConfigurator = dialogConfigurator.getElement(HTMLButtonElement, "button#close-configurator");
		const settings = cell.content;

		await VisualizerSettingsController.launch(cell, visualizer, dialogConfigurator, selectVisualizerVisualization);
		await AIController.launch(cell, visualizer, dialogConfigurator);

		buttonOpenConfigurator.addEventListener("click", async (event) => {
			event.stopPropagation();
			await this.#setActivity(true);
			settings.isOpenedConfigurator = dialogConfigurator.open;
			await cell.save(500);
		});

		buttonCloseConfigurator.addEventListener("click", async (event) => {
			await this.#setActivity(false);
			settings.isOpenedConfigurator = dialogConfigurator.open;
			await cell.save(500);
		});

		window.addEventListener("keydown", async (event) => {
			if (event.shiftKey || event.code !== "Tab") return;
			event.preventDefault();
			await this.#setActivity(!dialogConfigurator.open);
			settings.isOpenedConfigurator = dialogConfigurator.open;
			await cell.save(500);
		});

		await this.#setActivity(settings.isOpenedConfigurator);
	}
}
//#endregion
