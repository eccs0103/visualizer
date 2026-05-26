"use strict";

import "adaptive-extender/web";
import { Controller, ArchiveRepository } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";
import { VisualizerSettingsController } from "./visualizer-settings-controller.js";
import { AIController } from "./ai-controller.js";

//#region Configurator controller
export class ConfiguratorController extends Controller<[ArchiveRepository<typeof Settings>, Visualizer, HTMLDialogElement, HTMLButtonElement, HTMLSelectElement]> {
	#dialogConfigurator: HTMLDialogElement;

	async #setActivity(value: boolean): Promise<void> {
		const dialogConfigurator = this.#dialogConfigurator;
		const duration = 50;
		const fill: FillMode = "both";
		if (value) {
			dialogConfigurator.show();
			await dialogConfigurator.animate([{ opacity: "0", easing: "ease-in" }, { opacity: "1" }], { duration, fill }).finished;
		} else {
			await dialogConfigurator.animate([{ opacity: "1", easing: "ease-out" }, { opacity: "0" }], { duration, fill }).finished;
			dialogConfigurator.close();
		}
	}

	async run(repository: ArchiveRepository<typeof Settings>, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement, buttonOpenConfigurator: HTMLButtonElement, selectVisualizerVisualization: HTMLSelectElement): Promise<void> {
		this.#dialogConfigurator = dialogConfigurator;

		const buttonCloseConfigurator = dialogConfigurator.getElement(HTMLButtonElement, "button#close-configurator");
		const settings = repository.content;

		await VisualizerSettingsController.launch(repository, visualizer, dialogConfigurator, selectVisualizerVisualization);
		await AIController.launch(repository, visualizer, dialogConfigurator);

		buttonOpenConfigurator.addEventListener("click", async (event) => {
			event.stopPropagation();
			await this.#setActivity(true);
			settings.isOpenedConfigurator = dialogConfigurator.open;
			try { await repository.save(500); } catch { }
		});

		buttonCloseConfigurator.addEventListener("click", async (event) => {
			await this.#setActivity(false);
			settings.isOpenedConfigurator = dialogConfigurator.open;
			try { await repository.save(500); } catch { }
		});

		window.addEventListener("keydown", async (event) => {
			if (event.shiftKey || event.code !== "Tab") return;
			event.preventDefault();
			await this.#setActivity(!dialogConfigurator.open);
			settings.isOpenedConfigurator = dialogConfigurator.open;
			try { await repository.save(500); } catch { }
		});

		await this.#setActivity(settings.isOpenedConfigurator);
	}

	async catch(error: Error): Promise<void> {
		throw error;
	}
}
//#endregion
