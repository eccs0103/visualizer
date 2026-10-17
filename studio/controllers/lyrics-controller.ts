"use strict";

import "adaptive-extender/web";
import { BufferedCell, Controller } from "adaptive-extender/web";
import { PlaylistPlayer } from "../services/playlist-player.js";
import { LyricsFinder } from "../services/lyrics-finder.js";
import { Visualizer } from "../services/visualizer.js";
import { type Lyrics } from "../models/lyrics.js";
import { type Track } from "../models/playlist.js";
import { type Settings } from "../models/settings.js";

//#region Lyrics controller
export class LyricsController extends Controller<[BufferedCell<typeof Settings>, PlaylistPlayer, HTMLAudioElement, Visualizer, HTMLDialogElement]> {
	#audioPlayer: HTMLAudioElement;
	#visualizer: Visualizer;
	#finder: LyricsFinder;
	#enabled: boolean = true;
	#lyrics: Lyrics | null = null;
	#index: number = -1;

	#render(): void {
		const visualizer = this.#visualizer;
		const lyrics = this.#lyrics;
		if (!this.#enabled || lyrics === null) return visualizer.updateLyrics(null, null, null);
		const index = this.#index;
		visualizer.updateLyrics(lyrics.line(index - 1), lyrics.line(index), lyrics.line(index + 1));
	}

	#sync(): void {
		const lyrics = this.#lyrics;
		if (lyrics === null) return;
		const index = lyrics.at(this.#audioPlayer.currentTime);
		if (index === this.#index) return;
		this.#index = index;
		this.#render();
	}

	#follow(): void {
		if (this.#audioPlayer.paused) return;
		this.#sync();
	}

	async #onTrack(track: Track | null): Promise<void> {
		this.#lyrics = null;
		this.#index = -1;
		this.#render();
		await this.#finder.load(track);
	}

	async run(cell: BufferedCell<typeof Settings>, player: PlaylistPlayer, audioPlayer: HTMLAudioElement, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement): Promise<void> {
		const inputLyricsToggle = dialogConfigurator.getElement(HTMLInputElement, "input#lyrics-toggle");
		const inputShake = dialogConfigurator.getElement(HTMLInputElement, "input#lyrics-shake");
		const inputLyricsLookupToggle = dialogConfigurator.getElement(HTMLInputElement, "input#lyrics-lookup-toggle");
		this.#audioPlayer = audioPlayer;
		const settings = cell.content;
		this.#visualizer = visualizer;
		this.#enabled = settings.lyrics;
		const finder = this.#finder = new LyricsFinder(player, settings);

		finder.addEventListener("lyrics", (event) => {
			this.#lyrics = event.detail;
			this.#render();
		});

		player.addEventListener("track", event => void this.#onTrack(event.detail));
		visualizer.addEventListener("update", event => this.#follow());
		audioPlayer.addEventListener("seeked", event => this.#sync());

		inputLyricsToggle.checked = settings.lyrics;
		inputLyricsToggle.addEventListener("input", (event) => {
			this.#enabled = inputLyricsToggle.checked;
			this.#render();
		});
		inputLyricsToggle.addEventListener("change", async (event) => {
			settings.lyrics = inputLyricsToggle.checked;
			await cell.save(500);
		});

		inputShake.min = String(0);
		inputShake.max = String(1);
		inputShake.step = String(0.1);
		inputShake.value = String(settings.shake);
		visualizer.shake = settings.shake;
		inputShake.addEventListener("input", (event) => {
			visualizer.shake = Number(inputShake.value);
		});
		inputShake.addEventListener("change", async (event) => {
			settings.shake = Number(inputShake.value);
			await cell.save(500);
		});

		inputLyricsLookupToggle.checked = settings.lookup;
		inputLyricsLookupToggle.addEventListener("change", async (event) => {
			settings.lookup = inputLyricsLookupToggle.checked;
			await cell.save(500);
		});

		await this.#onTrack(player.current);
	}
}
//#endregion
