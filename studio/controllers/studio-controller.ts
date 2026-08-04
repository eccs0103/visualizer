"use strict";

import "adaptive-extender/web";
import { Controller, BufferedCell, MetadataInjector } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";
import { ObjectStore } from "../services/object-store.js";
import { WakeGuard } from "../services/wake-guard.js";
import { PlaylistPlayer } from "../services/playlist-player.js";
import { AudioController } from "./audio-controller.js";
import { VisualizerSettingsController } from "./visualizer-settings-controller.js";
import { AIController } from "./ai-controller.js";
import { PanelController } from "./panel-controller.js";
import { ClipController } from "./clip-controller.js";
import { PlaylistController } from "./playlist-controller.js";
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
			webpage: new URL("https://visualizer.eccs.dev/"),
			preview: new URL("../icons/equalizer.png", baseURI),
			category: "MultimediaApplication",
			os: "Web Browser",
			description: "AI-powered real-time music visualizer for browsers. A self-teaching DJ that auto-tunes the audio in real time, Canvas 2D rendering, and a simple API for custom visualizations.",
			keywords: ["music visualizer", "web audio", "canvas visualization", "real-time audio", "ai visualizer"],
		});
		void AnalyticsController.launch();

		const cell: BufferedCell<typeof Settings> = localStorage.openBufferedCell("Visualizer\\Studio\\Settings", Settings, new Settings());
		const store: ObjectStore = new ObjectStore("Visualizer", "Audiolist");
		const url = new URL(location.href);
		const search = new URLSearchParams(url.search);
		const isDeveloper = search.has("developer");
		if (!isDeveloper) {
			search.append("developer", "on");
			url.search = search.toString();
			console.log(`Are you a developer? Try ${url} for developer settings!`);
		}

		const audioPlayer = body.getElement(HTMLAudioElement, "audio#player");
		const canvasDisplay = body.getElement(HTMLCanvasElement, "canvas#display");
		const visualizer = new Visualizer(canvasDisplay, audioPlayer, { isDeveloper });
		const guard = new WakeGuard();
		const player = new PlaylistPlayer(audioPlayer, store, cell);

		const settings = cell.content;
		settings.reconcile();
		visualizer.rate = settings.rate;
		visualizer.autoCorrect = settings.autoCorrect;
		visualizer.visualization = settings.visualization;
		visualizer.quality = settings.configuration.quality;
		visualizer.smoothing = settings.configuration.smoothing;
		visualizer.focus = settings.configuration.focus;
		visualizer.spread = settings.configuration.spread;

		const divInterface = body.getElement(HTMLDivElement, "div#interface");
		const buttonOpenPlaylist = divInterface.getElement(HTMLButtonElement, "button#open-playlist");
		const buttonOpenConfigurator = divInterface.getElement(HTMLButtonElement, "button#open-configurator");
		const buttonClipToggle = divInterface.getElement(HTMLButtonElement, "button#clip-toggle");
		const buttonPlaybackPrevious = divInterface.getElement(HTMLButtonElement, "button#playback-previous");
		const buttonPlaybackNext = divInterface.getElement(HTMLButtonElement, "button#playback-next");
		const bPlaybackTitle = divInterface.getElement(HTMLElement, "b#playback-title");
		const bPlaybackTime = divInterface.getElement(HTMLElement, "b#playback-time");
		const bClipTime = divInterface.getElement(HTMLElement, "b#clip-time");
		const inputPlaybackTrack = divInterface.getElement(HTMLInputElement, "input#playback-track");
		const dialogConfigurator = body.getElement(HTMLDialogElement, "dialog#configurator");
		const buttonCloseConfigurator = dialogConfigurator.getElement(HTMLButtonElement, "button#close-configurator");
		const selectVisualizerVisualization = dialogConfigurator.getElement(HTMLSelectElement, "select#visualizer-visualization");
		const dialogPlaylist = body.getElement(HTMLDialogElement, "dialog#playlist");
		const buttonClosePlaylist = dialogPlaylist.getElement(HTMLButtonElement, "button#close-playlist");

		await AudioController.launch(guard, player, audioPlayer, divInterface, buttonPlaybackPrevious, buttonPlaybackNext, bPlaybackTitle, bPlaybackTime, inputPlaybackTrack);
		await ClipController.launch(guard, visualizer, canvasDisplay, audioPlayer, buttonClipToggle, bClipTime);
		await VisualizerSettingsController.launch(cell, visualizer, dialogConfigurator, selectVisualizerVisualization);
		await AIController.launch(cell, visualizer, dialogConfigurator);
		await PanelController.launch(cell, dialogPlaylist, dialogConfigurator, buttonOpenPlaylist, buttonClosePlaylist, buttonOpenConfigurator, buttonCloseConfigurator);
		await PlaylistController.launch(player, dialogPlaylist);

		await player.restore();
	}

	async catch(error: Error): Promise<void> {
		const message = `${error}\n\nAn error occurred. Any further actions may result in errors. To prevent this from happening, would you like to reload?`;
		if (window.confirm(message)) location.reload();
	}
}
//#endregion

await CorsIsolationController.launch();
await StudioController.launch();
