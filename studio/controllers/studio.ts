"use strict";

import "adaptive-extender/web";
import { Controller, ArchiveRepository } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";
import { ObjectStore } from "../services/object-store.js";
import "../view/visualizations.js";
import { AudioController } from "./audio.js";
import { ConfiguratorController } from "./configurator.js";

//#region Studio controller
class StudioController extends Controller {
	async run(): Promise<void> {
		const repository: ArchiveRepository<typeof Settings> = new ArchiveRepository("Visualizer\\Studio\\Settings", Settings, Settings.newDefault);
		const store: ObjectStore = new ObjectStore("Visualizer", "Audiolist");

		const { body } = document;
		const player = body.getElement(HTMLAudioElement, "audio#player");
		const loader = body.getElement(HTMLInputElement, "input#audio-loader");
		const canvas = body.getElement(HTMLCanvasElement, "canvas#display");
		const visualizer = new Visualizer(canvas, player);

		const settings = repository.content;
		visualizer.rate = settings.visualizer.rate;
		visualizer.autocorrect = settings.visualizer.autocorrect;
		visualizer.visualization = settings.visualizer.visualization;
		visualizer.quality = settings.visualizer.configuration.quality;
		visualizer.smoothing = settings.visualizer.configuration.smoothing;
		visualizer.focus = settings.visualizer.configuration.focus;
		visualizer.spread = settings.visualizer.configuration.spread;

		const panel = body.getElement(HTMLDivElement, "div#interface");
		const drive = panel.getElement(HTMLButtonElement, "button#audio-drive");
		const openButton = panel.getElement(HTMLButtonElement, "button#open-configurator");
		const timeLabel = panel.getElement(HTMLElement, "b#playback-time");
		const seekRange = panel.getElement(HTMLInputElement, "input#playback-track");
		const dialog = document.getElement(HTMLDialogElement, "dialog#configurator");
		const typeSelect = dialog.getElement(HTMLSelectElement, "select#visualizer-visualization");

		await AudioController.launch(store, player, loader, panel, drive, timeLabel, seekRange);
		await ConfiguratorController.launch(repository, visualizer, dialog, openButton, typeSelect);
	}

	async catch(error: Error): Promise<void> {
		const message = `${error}\n\nAn error occurred. Any further actions may result in errors. To prevent this from happening, would you like to reload?`;
		if (window.confirm(message)) location.reload();
	}
}
//#endregion
await StudioController.launch();
