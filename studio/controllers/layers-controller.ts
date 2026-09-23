"use strict";

import "adaptive-extender/web";
import { Controller, BufferedCell } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";
import { ObjectStore } from "../services/object-store.js";
import { LayersView } from "../view/layers-view.js";

//#region Layers controller
export class LayersController extends Controller<[BufferedCell<typeof Settings>, Visualizer, HTMLDialogElement, HTMLSelectElement]> {
	static #key: string = "background";
	static #maxSize: number = 50 * 1024 * 1024;
	#cell: BufferedCell<typeof Settings>;
	#visualizer: Visualizer;
	#view: LayersView;
	#store: ObjectStore = new ObjectStore("Visualizer\\Backgrounds", "Images");

	#arrange(): void {
		const { visualization, configuration } = this.#cell.content;
		this.#visualizer.arrange(visualization, configuration.layers);
	}

	#render(): void {
		const { engine, configuration } = this.#cell.content;
		this.#view.render(engine.lyrics, configuration.layers, engine.background);
	}

	async #restore(): Promise<void> {
		const { background } = this.#cell.content.engine;
		if (!background.hasImage) return;
		const image = await this.#store.get(LayersController.#key);
		if (image instanceof Blob) {
			this.#visualizer.setBackground(image);
			return;
		}
		console.error("The stored background image is missing, the background image was reset");
		background.image = null;
		this.#render();
		await this.#cell.save(500);
	}

	async #validate(file: File): Promise<string | null> {
		if (!file.type.startsWith("image/")) return "Choose an image file";
		if (file.size > LayersController.#maxSize) return "The image is larger than 50 MB";
		try {
			const probe = await createImageBitmap(file);
			probe.close();
		} catch {
			return "This image format is not supported";
		}
		return null;
	}

	async #upload(file: File): Promise<void> {
		const problem = await this.#validate(file);
		if (problem !== null) return this.#view.showMessage(problem);
		try {
			await this.#store.put(LayersController.#key, file);
		} catch (reason) {
			console.error(`Failed to store the background image:\n${Error.from(reason)}`);
			return this.#view.showMessage("The image could not be stored, the browser storage may be full");
		}
		this.#cell.content.engine.background.image = file.name;
		this.#visualizer.setBackground(file);
		this.#render();
		await this.#cell.save(500);
	}

	async #remove(): Promise<void> {
		await this.#store.delete(LayersController.#key);
		this.#cell.content.engine.background.image = null;
		this.#visualizer.setBackground(null);
		this.#render();
		await this.#cell.save(500);
	}

	async run(cell: BufferedCell<typeof Settings>, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement, selectVisualizerVisualization: HTMLSelectElement): Promise<void> {
		this.#cell = cell;
		this.#visualizer = visualizer;
		const olVisualizationLayers = dialogConfigurator.getElement(HTMLOListElement, "ol#visualization-layers");
		const view = this.#view = new LayersView(olVisualizationLayers);
		const settings = cell.content;
		const { engine } = settings;

		for (const [name, configuration] of settings.attachments) visualizer.arrange(name, configuration.layers);
		visualizer.configure(engine);
		this.#render();

		selectVisualizerVisualization.addEventListener("change", event => this.#render());

		view.addEventListener("adjust", async event => {
			if (event.detail === engine.background || event.detail === engine.lyrics) visualizer.configure(engine);
			else this.#arrange();
			await cell.save(500);
		});

		view.addEventListener("reorder", async event => {
			if (!settings.configuration.move(event.detail)) return;
			this.#arrange();
			this.#render();
			await cell.save(500);
		});

		view.addEventListener("upload", async event => await this.#upload(event.detail));
		view.addEventListener("remove", async event => await this.#remove());

		await this.#restore();
	}
}
//#endregion
