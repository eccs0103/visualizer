"use strict";

import "adaptive-extender/web";
import { Controller, BufferedCell } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";
import { LayersView } from "../view/layers-view.js";

//#region Layers controller
export class LayersController extends Controller<[BufferedCell<typeof Settings>, Visualizer, HTMLDialogElement, HTMLSelectElement]> {
	#cell: BufferedCell<typeof Settings>;
	#visualizer: Visualizer;

	#arrange(): void {
		const { visualization, configuration } = this.#cell.content;
		this.#visualizer.arrange(visualization, configuration.layers);
	}

	async run(cell: BufferedCell<typeof Settings>, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement, selectVisualizerVisualization: HTMLSelectElement): Promise<void> {
		this.#cell = cell;
		this.#visualizer = visualizer;
		const olVisualizationLayers = dialogConfigurator.getElement(HTMLOListElement, "ol#visualization-layers");
		const view = new LayersView(olVisualizationLayers);
		const settings = cell.content;

		for (const [name, configuration] of settings.attachments) visualizer.arrange(name, configuration.layers);
		view.render(settings.configuration.layers);

		selectVisualizerVisualization.addEventListener("change", event => view.render(settings.configuration.layers));

		view.addEventListener("adjust", async event => {
			this.#arrange();
			await cell.save(500);
		});

		view.addEventListener("reorder", async event => {
			if (!settings.configuration.move(event.detail)) return;
			this.#arrange();
			view.render(settings.configuration.layers);
			await cell.save(500);
		});
	}
}
//#endregion
