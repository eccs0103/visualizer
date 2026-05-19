"use strict";

import "adaptive-extender/web";
import { Controller, ArchiveRepository } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";
import { VisualizerSettingsController } from "./visualizer-settings-controller.js";
import { AIController } from "./ai-controller.js";

//#region Configurator controller
export class ConfiguratorController extends Controller<[repository: ArchiveRepository<typeof Settings>, visualizer: Visualizer, dialog: HTMLDialogElement, openButton: HTMLButtonElement, typeSelect: HTMLSelectElement]> {
	#dialog: HTMLDialogElement;
	#repository: ArchiveRepository<typeof Settings>;

	async #setActivity(value: boolean): Promise<void> {
		const dialog = this.#dialog;
		const duration = 50;
		const fill: FillMode = "both";
		if (value) {
			dialog.show();
			await dialog.animate([{ opacity: "0", easing: "ease-in" }, { opacity: "1" }], { duration, fill }).finished;
		} else {
			await dialog.animate([{ opacity: "1", easing: "ease-out" }, { opacity: "0" }], { duration, fill }).finished;
			dialog.close();
		}
	}

	async run(repository: ArchiveRepository<typeof Settings>, visualizer: Visualizer, dialog: HTMLDialogElement, openButton: HTMLButtonElement, typeSelect: HTMLSelectElement): Promise<void> {
		this.#dialog = dialog;
		this.#repository = repository;

		const closeButton = dialog.getElement(HTMLButtonElement, "button#close-configurator");
		const settings = repository.content;

		await VisualizerSettingsController.launch(repository, visualizer, dialog, typeSelect);
		await AIController.launch(visualizer, dialog);

		openButton.addEventListener("click", async (event) => {
			event.stopPropagation();
			await this.#setActivity(true);
			settings.isOpenedConfigurator = dialog.open;
			await repository.save(500);
		});

		closeButton.addEventListener("click", async (event) => {
			await this.#setActivity(false);
			settings.isOpenedConfigurator = dialog.open;
			await repository.save(500);
		});

		window.addEventListener("keydown", async (event) => {
			if (event.shiftKey || event.code !== "Tab") return;
			event.preventDefault();
			await this.#setActivity(!dialog.open);
			settings.isOpenedConfigurator = dialog.open;
			await repository.save(500);
		});

		await this.#setActivity(settings.isOpenedConfigurator);
	}
}
//#endregion
