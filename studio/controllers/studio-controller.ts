"use strict";

import "adaptive-extender/web";
import { Controller, BufferedCell, MetadataInjector, type Store } from "adaptive-extender/web";
import { Settings, LegacySettings } from "../models/settings.js";
import { Playlist } from "../models/playlist.js";
import { Visualizer } from "../services/visualizer.js";
import { WakeGuard } from "../services/wake-guard.js";
import { PlaylistPlayer } from "../services/playlist-player.js";
import { LegacyLyrics } from "../services/legacy-stores.js";
import { AudioController } from "./audio-controller.js";
import { VisualizerSettingsController } from "./visualizer-settings-controller.js";
import { DeveloperController } from "./developer-controller.js";
import { LayersController } from "./layers-controller.js";
import { PanelController } from "./panel-controller.js";
import { ClipController } from "./clip-controller.js";
import { PlaylistController } from "./playlist-controller.js";
import { LyricsController } from "./lyrics-controller.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";
import { CrossOriginIsolationController } from "../../environment/controllers/coi-controller.js";
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
		const { playlist: inherited } = localStorage.openPortableCell(cell.key, LegacySettings, new LegacySettings()).content;
		const playlist: BufferedCell<typeof Playlist> = localStorage.openBufferedCell("Visualizer\\Studio\\Playlist", Playlist, inherited ?? new Playlist());
		if (inherited !== undefined) void cell.save();
		const store: Store<string> = indexedDB.openStore("Visualizer", "Audiolist");
		const lyrics: Store<string> = indexedDB.openStore("Visualizer", "Lyrics");
		const legacy: Store<number> = indexedDB.openStore<number>("Visualizer", "Audiolist");
		await LegacyLyrics.migrate(store, lyrics);

		const audioPlayer = body.getElement(HTMLAudioElement, "audio#player");
		const canvasDisplay = body.getElement(HTMLCanvasElement, "canvas#display");
		const visualizer = new Visualizer(canvasDisplay, audioPlayer);
		const guard = new WakeGuard();
		const player = new PlaylistPlayer(audioPlayer, store, lyrics, legacy, playlist);

		const settings = cell.content;
		settings.reconcile();
		visualizer.rate = settings.rate;
		visualizer.visualization = settings.visualization;
		visualizer.manager.apply(settings.configuration);

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
		const inputLyricsToggle = dialogConfigurator.getElement(HTMLInputElement, "input#lyrics-toggle");
		const inputShake = dialogConfigurator.getElement(HTMLInputElement, "input#lyrics-shake");
		const inputLyricsLookupToggle = dialogConfigurator.getElement(HTMLInputElement, "input#lyrics-lookup-toggle");
		const dialogPlaylist = body.getElement(HTMLDialogElement, "dialog#playlist");
		const buttonClosePlaylist = dialogPlaylist.getElement(HTMLButtonElement, "button#close-playlist");

		await AudioController.launch(guard, player, audioPlayer, divInterface, buttonPlaybackPrevious, buttonPlaybackNext, bPlaybackTitle, bPlaybackTime, inputPlaybackTrack);
		await ClipController.launch(guard, visualizer, canvasDisplay, audioPlayer, buttonClipToggle, bClipTime);
		await LyricsController.launch(cell, player, audioPlayer, visualizer, inputLyricsToggle, inputShake, inputLyricsLookupToggle);
		await VisualizerSettingsController.launch(cell, visualizer, dialogConfigurator, selectVisualizerVisualization);
		await DeveloperController.launch(visualizer, dialogConfigurator);
		await LayersController.launch(cell, visualizer, dialogConfigurator, selectVisualizerVisualization);
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

await CrossOriginIsolationController.launch();
await StudioController.launch();
