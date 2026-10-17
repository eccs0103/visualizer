"use strict";

import "adaptive-extender/web";
import { LrclibResult } from "../models/lrclib-result.js";
import { Lyrics } from "../models/lyrics.js";
import { type Track } from "../models/playlist.js";
import { type Settings } from "../models/settings.js";
import { type PlaylistPlayer } from "./playlist-player.js";

//#region Lyrics finder
export interface LyricsFinderEventMap {
	"lyrics": CustomEvent<Lyrics>;
}

// ponytail: matches on the bare filename and a duration window; add artist/title tag parsing if the hit rate is bad
export class LyricsFinder extends EventTarget {
	static #tolerance = 5;
	static #cooldown = 5000;
	static #untilRetry = 0;
	static #delays: readonly number[] = [5000, 15000, 40000];
	static #lifespan = 24 * 60 * 60 * 1000;

	#player: PlaylistPlayer;
	#settings: Settings;
	#idTrack: string | null = null;
	#abort: AbortController | null = null;

	constructor(player: PlaylistPlayer, settings: Settings) {
		super();
		this.#player = player;
		this.#settings = settings;
	}

	addEventListener<K extends keyof LyricsFinderEventMap>(type: K, listener: (this: LyricsFinder, event: LyricsFinderEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof LyricsFinderEventMap>(type: K, listener: (this: LyricsFinder, event: LyricsFinderEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		return super.removeEventListener(type, listener, options);
	}

	static async #find(signature: string, duration: number, signal: AbortSignal): Promise<string | null> {
		if (Date.now() < LyricsFinder.#untilRetry) throw new Error("lrclib search is cooling down after a recent failure");

		try {
			const url = new URL("https://lrclib.net/api/search");
			url.searchParams.set("q", signature);
			const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
			if (!response.ok) throw new Error(`lrclib search failed with status ${response.status}`);

			const results = Array.Of<LrclibResult, unknown>(LrclibResult).import(await response.json(), "results");
			let best: string | null = null;
			let bestGap = Infinity;
			for (const result of results) {
				if (!result.isSynced) continue;
				const gap = result.gap(duration);
				if (gap >= bestGap) continue;
				best = result.lyrics;
				bestGap = gap;
			}

			LyricsFinder.#untilRetry = 0;
			if (best === null || bestGap > LyricsFinder.#tolerance) return null;
			return best;
		} catch (reason) {
			if (!signal.aborted) LyricsFinder.#untilRetry = Date.now() + LyricsFinder.#cooldown;
			throw reason;
		}
	}

	async #revalidate(track: Track, stored: string, signal: AbortSignal): Promise<void> {
		try {
			const found = await LyricsFinder.#find(track.signature, track.duration, signal);
			if (this.#idTrack !== track.id) return;

			let text = found ?? String.empty;
			if (String.isEmpty(text) && !String.isEmpty(stored)) text = stored;
			await this.#player.setLyrics(track, text, Date.now());
			if (text === stored) return;

			this.dispatchEvent(new CustomEvent("lyrics", { detail: Lyrics.parse(text) }));
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
			if (checked !== null && Date.now() - checked >= LyricsFinder.#lifespan) void this.#revalidate(track, stored, signal);
			return stored;
		}
		if (!this.#settings.lookup) return stored;

		const delays = LyricsFinder.#delays;
		for (let attempt = 0; attempt <= delays.length; attempt++) {
			if (this.#idTrack !== track.id) return null;
			try {
				const found = await LyricsFinder.#find(track.signature, track.duration, signal);
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

	async load(track: Track | null): Promise<void> {
		this.#abort?.abort();
		this.#abort = null;
		this.#idTrack = null;
		if (track === null) return;

		this.#idTrack = track.id;
		const abort = this.#abort = new AbortController();
		const resolved = await this.#resolveLyrics(track, abort.signal);
		if (this.#idTrack !== track.id) return;

		this.dispatchEvent(new CustomEvent("lyrics", { detail: Lyrics.parse(resolved ?? String.empty) }));
	}
}
//#endregion
