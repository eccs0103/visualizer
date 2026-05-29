"use strict";

import "adaptive-extender/web";
import { Controller, ArchiveRepository } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";
import { ObjectStore } from "../services/object-store.js";
import { AudioController } from "./audio-controller.js";
import { ConfiguratorController } from "./configurator-controller.js";
import { ClipController } from "./clip-controller.js";
import { MetadataInjector } from "../../environment/services/metadata-injector.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";
import { CorsIsolationController } from "../../environment/controllers/coi-controller.js";
import "../view/visualizations.js";

const { baseURI, body } = document;

//#region Studio controller
class StudioController extends Controller {
	async run(): Promise<void> {
		MetadataInjector.inject({
			type: "Application",
			name: "Visualizer",
			webpage: new URL("https://eccs0103.github.io/visualizer/"),
			preview: new URL("../assets/icons/equalizer.png", new URL(baseURI)),
			category: "MultimediaApplication",
			os: "Web Browser",
			description: "AI-powered real-time music visualizer for browsers. Neural-network scene detection, Canvas 2D rendering, and a simple API for custom visualizations.",
			keywords: ["music visualizer", "web audio", "canvas visualization", "real-time audio", "ai visualizer"],
		});
		void AnalyticsController.launch();

		const repository: ArchiveRepository<typeof Settings> = new ArchiveRepository("Visualizer\\Studio\\Settings", Settings, Settings.newDefault);
		const store: ObjectStore = new ObjectStore("Visualizer", "Audiolist");
		const search = new URLSearchParams(location.search);
		const isDeveloper = search.has("developer");

		const audioPlayer = body.getElement(HTMLAudioElement, "audio#player");
		const inputAudioLoader = body.getElement(HTMLInputElement, "input#audio-loader");
		const canvasDisplay = body.getElement(HTMLCanvasElement, "canvas#display");
		const visualizer = new Visualizer(canvasDisplay, audioPlayer, { isDeveloper });

		const settings = repository.content;
		visualizer.rate = settings.rate;
		visualizer.autoCorrect = settings.autoCorrect;
		visualizer.visualization = settings.visualization;
		visualizer.quality = settings.configuration.quality;
		visualizer.smoothing = settings.configuration.smoothing;
		visualizer.focus = settings.configuration.focus;
		visualizer.spread = settings.configuration.spread;

		const divInterface = body.getElement(HTMLDivElement, "div#interface");
		const buttonAudioDrive = divInterface.getElement(HTMLButtonElement, "button#audio-drive");
		const buttonOpenConfigurator = divInterface.getElement(HTMLButtonElement, "button#open-configurator");
		const buttonClipToggle = divInterface.getElement(HTMLButtonElement, "button#clip-toggle");
		const bPlaybackTime = divInterface.getElement(HTMLElement, "b#playback-time");
		const bClipTime = divInterface.getElement(HTMLElement, "b#clip-time");
		const inputPlaybackTrack = divInterface.getElement(HTMLInputElement, "input#playback-track");
		const dialogConfigurator = body.getElement(HTMLDialogElement, "dialog#configurator");
		const selectVisualizerVisualization = dialogConfigurator.getElement(HTMLSelectElement, "select#visualizer-visualization");

		await AudioController.launch(store, audioPlayer, inputAudioLoader, divInterface, buttonAudioDrive, bPlaybackTime, inputPlaybackTrack);
		await ClipController.launch(visualizer, canvasDisplay, audioPlayer, buttonClipToggle, bClipTime);
		await ConfiguratorController.launch(repository, visualizer, dialogConfigurator, buttonOpenConfigurator, selectVisualizerVisualization);
	}

	async catch(error: Error): Promise<void> {
		const message = `${error}\n\nAn error occurred. Any further actions may result in errors. To prevent this from happening, would you like to reload?`;
		if (window.confirm(message)) location.reload();
	}
}
//#endregion

await CorsIsolationController.launch();
await StudioController.launch();
