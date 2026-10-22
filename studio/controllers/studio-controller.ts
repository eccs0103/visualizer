"use strict";

import "adaptive-extender/web";
import { Controller, BufferedCell, MetadataInjector, type Store, type PortableStore } from "adaptive-extender/web";
import { Settings, LegacySettings } from "../models/settings.js";
import { Playlist } from "../models/playlist.js";
import { FileRow, TextRow } from "../models/rows.js";
import { Visualizer } from "../services/visualizer.js";
import { WakeGuard } from "../services/wake-guard.js";
import { PlaylistPlayer } from "../services/playlist-player.js";
import { ClipRecorder } from "../services/clip-recorder.js";
import { Smoothness } from "../services/smoothness.js";
import { LegacyAudio, LegacyLyrics, LegacyBareFiles, LegacyBareTexts } from "../services/legacy-stores.js";
import { AudioController } from "./audio-controller.js";
import { VisualizerSettingsController } from "./visualizer-settings-controller.js";
import { SplitterController } from "./splitter-controller.js";
import { SplitterCollector } from "./splitter-collector.js";
import { NoticeController } from "./notice-controller.js";
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
			description: "AI-powered real-time music visualizer for browsers. An AI splits every song into instruments (drums, bass, vocals, guitar, keys and the rest) so the visuals react to each one, Canvas 2D rendering, and a simple API for custom visualizations.",
			keywords: ["music visualizer", "web audio", "canvas visualization", "real-time audio", "ai visualizer"],
		});
		void AnalyticsController.launch();

		const url = new URL(location.href);
		const developer = url.searchParams.get("for") === "developers";
		if (developer) await import("../view/visualizations/stems.js");
		url.searchParams.set("for", "developers");
		if (!developer) console.log(`Are you a developer? Try ${url} for developer settings!`);
		const cell: BufferedCell<typeof Settings> = localStorage.openBufferedCell("Visualizer\\Studio\\Settings", Settings, new Settings());
		const { playlist: inherited } = localStorage.openPortableCell(cell.key, LegacySettings, new LegacySettings()).content;
		const playlist: BufferedCell<typeof Playlist> = localStorage.openBufferedCell("Visualizer\\Studio\\Playlist", Playlist, inherited ?? new Playlist());
		if (inherited !== undefined) void cell.save();
		const store: PortableStore<typeof FileRow, "id"> = indexedDB.openPortableStore("Visualizer", "Audiolist", FileRow, "id");
		const lyrics: PortableStore<typeof TextRow, "id"> = indexedDB.openPortableStore("Visualizer", "Lyrics", TextRow, "id");
		const rawAudiolist: Store<string> = indexedDB.openStore("Visualizer", "Audiolist");
		const rawLyrics: Store<string> = indexedDB.openStore("Visualizer", "Lyrics");
		const legacy: Store<number> = indexedDB.openStore<number>("Visualizer", "Audiolist");
		await LegacyBareTexts.migrate(rawLyrics, lyrics);
		await LegacyBareFiles.migrate(rawAudiolist, store);
		await LegacyLyrics.migrate(rawAudiolist, lyrics);

		const audioPlayer = body.getElement(HTMLAudioElement, "audio#player");
		const canvasDisplay = body.getElement(HTMLCanvasElement, "canvas#display");
		const visualizer = new Visualizer(canvasDisplay, audioPlayer);
		const guard = new WakeGuard();
		const player = new PlaylistPlayer(audioPlayer, store, lyrics, playlist);
		const recorder = new ClipRecorder(canvasDisplay, audioPlayer);
		const smoothness = new Smoothness(visualizer);
		smoothness.addEventListener("measure", event => visualizer.splitter.pace(event.detail));

		const settings = cell.content;
		const catalog = await visualizer.splitter.catalog;
		settings.reconcile(catalog);
		visualizer.rate = settings.rate;
		visualizer.visualization = settings.visualization;
		visualizer.manager.apply(settings.configuration);

		const divInterface = body.getElement(HTMLDivElement, "div#interface");
		const dialogConfigurator = body.getElement(HTMLDialogElement, "dialog#configurator");
		const dialogPlaylist = body.getElement(HTMLDialogElement, "dialog#playlist");

		await AudioController.launch(guard, player, audioPlayer, divInterface);
		await ClipController.launch(guard, visualizer, recorder, divInterface);
		await LyricsController.launch(cell, player, audioPlayer, visualizer, dialogConfigurator);
		await VisualizerSettingsController.launch(cell, visualizer, smoothness, dialogConfigurator);
		await SplitterController.launch(developer, cell, visualizer, dialogConfigurator);
		await NoticeController.launch(visualizer, smoothness, recorder, divInterface);
		void SplitterCollector.launch(visualizer, smoothness, recorder);
		await LayersController.launch(cell, visualizer, dialogConfigurator);
		await PanelController.launch(cell, divInterface, dialogPlaylist, dialogConfigurator);
		await PlaylistController.launch(player, dialogPlaylist);

		await LegacyAudio.migrate(legacy, player);
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
