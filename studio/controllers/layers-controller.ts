"use strict";

import "adaptive-extender/web";
import { Controller, BufferedCell, type Store, type PortableStore } from "adaptive-extender/web";
import { Settings, type VisualizationSettings } from "../models/settings.js";
import { FileRow } from "../models/rows.js";
import { Visualizer } from "../services/visualizer.js";
import { LayersView } from "../view/layers-view.js";
import { LegacyBackgrounds, LegacyBareFiles } from "../services/legacy-stores.js";

//#region Layers controller
export class LayersController extends Controller<[BufferedCell<typeof Settings>, Visualizer, HTMLDialogElement]> {
	static #maxSize: number = 50 * 1024 * 1024;
	#cell: BufferedCell<typeof Settings>;
	#visualizer: Visualizer;
	#view: LayersView;
	#store: PortableStore<typeof FileRow, "id"> = indexedDB.openPortableStore("Visualizer", "Backgrounds", FileRow, "id");

	#arrange(visualization: string, configuration: VisualizationSettings): void {
		const { layers, background, lyrics } = configuration;
		this.#visualizer.arrange(visualization, layers, background, lyrics);
	}

	#render(): void {
		const { lyrics, layers, background } = this.#cell.content.configuration;
		this.#view.render(lyrics, layers, background);
	}

	async #restore(): Promise<void> {
		const cell = this.#cell;
		const store = this.#store;
		const settings = cell.content;
		const raw: Store<string> = indexedDB.openStore("Visualizer", "Backgrounds");
		await LegacyBareFiles.migrate(raw, store);
		await LegacyBackgrounds.migrate(store);
		let isReset = false;
		for (const [name, configuration] of settings.attachments) {
			const { background } = configuration;
			if (!background.hasImage) continue;
			const row = await store.select(name);
			if (row !== null) {
				this.#visualizer.setBackground(name, row.file);
				continue;
			}
			console.error(`The stored background image of '${name}' is missing, the background image was reset`);
			background.image = null;
			isReset = true;
		}
		if (!isReset) return;
		this.#render();
		await cell.save(500);
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
		const cell = this.#cell;
		const view = this.#view;
		const { visualization, configuration } = cell.content;
		const problem = await this.#validate(file);
		if (problem !== null) return view.showMessage(problem);
		try {
			await this.#store.upsert(new FileRow(visualization, file));
		} catch (reason) {
			console.error(`Failed to store the background image:\n${Error.from(reason)}`);
			return view.showMessage("The image could not be stored, the browser storage may be full");
		}
		configuration.background.image = file.name;
		this.#visualizer.setBackground(visualization, file);
		this.#render();
		await cell.save(500);
	}

	async #remove(): Promise<void> {
		const cell = this.#cell;
		const { visualization, configuration } = cell.content;
		await this.#store.delete(visualization);
		configuration.background.image = null;
		this.#visualizer.setBackground(visualization, null);
		this.#render();
		await cell.save(500);
	}

	async run(cell: BufferedCell<typeof Settings>, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement): Promise<void> {
		this.#cell = cell;
		this.#visualizer = visualizer;
		const olVisualizationLayers = dialogConfigurator.getElement(HTMLOListElement, "ol#visualization-layers");
		const view = this.#view = new LayersView(olVisualizationLayers);
		const settings = cell.content;

		for (const [name, configuration] of settings.attachments) this.#arrange(name, configuration);
		this.#render();

		dialogConfigurator.getElement(HTMLSelectElement, "select#visualizer-visualization").addEventListener("change", event => this.#render());

		view.addEventListener("adjust", async event => {
			this.#arrange(settings.visualization, settings.configuration);
			await cell.save(500);
		});

		view.addEventListener("reorder", async event => {
			if (!settings.configuration.move(event.detail)) return;
			this.#arrange(settings.visualization, settings.configuration);
			this.#render();
			await cell.save(500);
		});

		view.addEventListener("upload", async event => await this.#upload(event.detail));
		view.addEventListener("remove", async event => await this.#remove());

		await this.#restore();
	}
}
//#endregion
