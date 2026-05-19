"use strict";

import "adaptive-extender/web";
import { Controller, ArchiveRepository } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";
import { ObjectStore } from "../services/object-store.js";
import "../view/visualizations.js";
import { AudioController } from "./audio-controller.js";
import { ConfiguratorController } from "./configurator-controller.js";

//#region Studio controller
class StudioController extends Controller {
	async run(): Promise<void> {
		const repository: ArchiveRepository<typeof Settings> = new ArchiveRepository("Visualizer\\Studio\\Settings", Settings, Settings.newDefault);
		const store: ObjectStore = new ObjectStore("Visualizer", "Audiolist");

		const { body } = document;
		const audioPlayer = body.getElement(HTMLAudioElement, "audio#player");
		const inputAudioLoader = body.getElement(HTMLInputElement, "input#audio-loader");
		const canvasDisplay = body.getElement(HTMLCanvasElement, "canvas#display");
		const visualizer = new Visualizer(canvasDisplay, audioPlayer);

		const settings = repository.content;
		visualizer.rate = settings.visualizer.rate;
		visualizer.autocorrect = settings.visualizer.autocorrect;
		visualizer.visualization = settings.visualizer.visualization;
		visualizer.quality = settings.visualizer.configuration.quality;
		visualizer.smoothing = settings.visualizer.configuration.smoothing;
		visualizer.focus = settings.visualizer.configuration.focus;
		visualizer.spread = settings.visualizer.configuration.spread;

		const divInterface = body.getElement(HTMLDivElement, "div#interface");
		const buttonAudioDrive = divInterface.getElement(HTMLButtonElement, "button#audio-drive");
		const buttonOpenConfigurator = divInterface.getElement(HTMLButtonElement, "button#open-configurator");
		const bPlaybackTime = divInterface.getElement(HTMLElement, "b#playback-time");
		const inputPlaybackTrack = divInterface.getElement(HTMLInputElement, "input#playback-track");
		const dialogConfigurator = document.getElement(HTMLDialogElement, "dialog#configurator");
		const selectVisualizerVisualization = dialogConfigurator.getElement(HTMLSelectElement, "select#visualizer-visualization");

		await AudioController.launch(store, audioPlayer, inputAudioLoader, divInterface, buttonAudioDrive, bPlaybackTime, inputPlaybackTrack);
		await ConfiguratorController.launch(repository, visualizer, dialogConfigurator, buttonOpenConfigurator, selectVisualizerVisualization);
	}

	async catch(error: Error): Promise<void> {
		const message = `${error}\n\nAn error occurred. Any further actions may result in errors. To prevent this from happening, would you like to reload?`;
		if (window.confirm(message)) location.reload();
	}
}
//#endregion

await StudioController.launch();
