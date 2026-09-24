"use strict";

import "adaptive-extender/web";
import { BufferedCell, Controller } from "adaptive-extender/web";
import { PlaylistPlayer } from "../services/playlist-player.js";
import { LyricsFinder } from "../services/lyrics-finder.js";
import { Visualizer } from "../services/visualizer.js";
import { Lyrics } from "../models/lyrics.js";
import { type Track } from "../models/playlist.js";
import { type Settings } from "../models/settings.js";

//#region Lyrics controller
export class LyricsController extends Controller<[BufferedCell<typeof Settings>, PlaylistPlayer, HTMLAudioElement, Visualizer, HTMLInputElement, HTMLInputElement, HTMLInputElement]> {
	#player: PlaylistPlayer;
	#audioPlayer: HTMLAudioElement;
	#settings: Settings;
	#visualizer: Visualizer;
	#enabled: boolean = true;
	#lyrics: Lyrics | null = null;
	#index: number = -1;
	#frame: number | null = null;
	#idTrack: string | null = null;
	#abort: AbortController | null = null;

	static #delays: readonly number[] = [5000, 15000, 40000];
	static #lifespan = 24 * 60 * 60 * 1000;

	#lineAt(lyrics: Lyrics, index: number): string | null {
		const line = lyrics.lines[index];
		if (line === undefined) return null;
		return line.text;
	}

	#render(): void {
		const visualizer = this.#visualizer;
		if (!this.#enabled) { visualizer.updateLyrics(null, null, null); return; }
		const lyrics = this.#lyrics;
		if (lyrics === null || lyrics.isEmpty) { visualizer.updateLyrics(null, null, null); return; }
		const index = this.#index;
		const previous = this.#lineAt(lyrics, index - 1);
		const current = this.#lineAt(lyrics, index);
		const next = this.#lineAt(lyrics, index + 1);
		visualizer.updateLyrics(previous, current, next);
	}

	#sync(): void {
		const lyrics = this.#lyrics;
		if (lyrics === null) return;
		const index = lyrics.at(this.#audioPlayer.currentTime);
		if (index === this.#index) return;
		this.#index = index;
		this.#render();
	}

	#tick(): void {
		this.#sync();
		this.#frame = requestAnimationFrame(() => this.#tick());
	}

	#startLoop(): void {
		if (this.#frame !== null) return;
		this.#frame = requestAnimationFrame(() => this.#tick());
	}

	#stopLoop(): void {
		const frame = this.#frame;
		if (frame === null) return;
		cancelAnimationFrame(frame);
		this.#frame = null;
	}

	async #revalidate(track: Track, stored: string, signal: AbortSignal): Promise<void> {
		try {
			const found = await LyricsFinder.find(track.signature, track.duration, signal);
			if (this.#idTrack !== track.id) return;

			let text = found ?? String.empty;
			if (String.isEmpty(text) && !String.isEmpty(stored)) text = stored;
			await this.#player.setLyrics(track, text, Date.now());
			if (text === stored) return;

			this.#lyrics = Lyrics.parse(text);
			this.#render();
			if (!this.#audioPlayer.paused && !this.#lyrics.isEmpty) this.#startLoop();
		} catch {
			return;
		}
	}

	async #resolveLyrics(track: Track, signal: AbortSignal): Promise<string | null> {
		const player = this.#player;
		const stored = await player.readLyrics(track);
		const isPoisoned = stored !== null && String.isEmpty(stored) && track.checked === null;
		if (stored !== null && !isPoisoned) {
			const { checked } = track;
			if (checked !== null && Date.now() - checked >= LyricsController.#lifespan) void this.#revalidate(track, stored, signal);
			return stored;
		}
		if (!this.#settings.lookup) return stored;

		const delays = LyricsController.#delays;
		for (let attempt = 0; attempt <= delays.length; attempt++) {
			if (this.#idTrack !== track.id) return null;
			try {
				const found = await LyricsFinder.find(track.signature, track.duration, signal);
				const text = found ?? String.empty;
				if (this.#idTrack !== track.id) return null;
				await player.setLyrics(track, text, Date.now());
				return text;
			} catch {
				const delay = delays[attempt];
				if (delay === undefined) return null;
				await Promise.asTimeout(delay);
			}
		}
		return null;
	}

	async #onTrack(track: Track | null): Promise<void> {
		const abort2 = this.#abort;
		if (abort2 !== null) abort2.abort();
		let idTrack: string | null = null;
		if (track !== null) idTrack = track.id;
		this.#idTrack = idTrack;
		this.#lyrics = null;
		this.#index = -1;
		this.#stopLoop();
		this.#render();

		if (track === null) {
			this.#abort = null;
			return;
		}

		const abort = new AbortController();
		this.#abort = abort;
		const resolved = await this.#resolveLyrics(track, abort.signal);
		if (this.#idTrack !== track.id) return;

		let content = resolved;
		if (content === null) content = String.empty;
		this.#lyrics = Lyrics.parse(content);
		this.#render();
		if (!this.#audioPlayer.paused && !this.#lyrics.isEmpty) this.#startLoop();
	}

	async run(cell: BufferedCell<typeof Settings>, player: PlaylistPlayer, audioPlayer: HTMLAudioElement, visualizer: Visualizer, inputLyricsToggle: HTMLInputElement, inputShake: HTMLInputElement, inputLyricsLookupToggle: HTMLInputElement): Promise<void> {
		this.#player = player;
		this.#audioPlayer = audioPlayer;
		const settings = this.#settings = cell.content;
		this.#visualizer = visualizer;
		this.#enabled = settings.lyrics;

		player.addEventListener("track", event => void this.#onTrack(event.detail));
		audioPlayer.addEventListener("play", (event) => {
			const lyrics = this.#lyrics;
			if (lyrics === null || lyrics.isEmpty) return;
			this.#startLoop();
		});
		audioPlayer.addEventListener("pause", event => this.#stopLoop());
		audioPlayer.addEventListener("emptied", event => this.#stopLoop());
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
