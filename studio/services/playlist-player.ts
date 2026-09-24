"use strict";

import "adaptive-extender/web";
import { BufferedCell } from "adaptive-extender/web";
import { ObjectStore } from "./object-store.js";
import { Playlist, PlaybackMode, Track } from "../models/playlist.js";
import { Settings } from "../models/settings.js";

//#region Playlist player
export interface PlaylistPlayerEventMap {
	"change": Event;
	"track": CustomEvent<Track | null>;
}

export class PlaylistPlayer extends EventTarget {
	#audioPlayer: HTMLAudioElement;
	#store: ObjectStore;
	#cell: BufferedCell<typeof Settings>;

	constructor(audioPlayer: HTMLAudioElement, store: ObjectStore, cell: BufferedCell<typeof Settings>) {
		super();
		this.#audioPlayer = audioPlayer;
		this.#store = store;
		this.#cell = cell;
	}

	addEventListener<K extends keyof PlaylistPlayerEventMap>(type: K, listener: (this: PlaylistPlayer, event: PlaylistPlayerEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof PlaylistPlayerEventMap>(type: K, listener: (this: PlaylistPlayer, event: PlaylistPlayerEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		return super.removeEventListener(type, listener, options);
	}

	get #playlist(): Playlist { return this.#cell.content.playlist; }
	get tracks(): readonly Track[] { return this.#playlist.tracks; }
	get index(): number { return this.#playlist.index; }
	get mode(): PlaybackMode { return this.#playlist.mode; }
	get isEmpty(): boolean { return this.#playlist.isEmpty; }
	get current(): Track | null { return this.#playlist.current; }

	static #lyricsExtensions = new Set([".lrc", ".txt"]);

	static #isLyricsFile(file: File): boolean {
		const index = file.name.lastIndexOf(".");
		if (index < 0) return false;
		return PlaylistPlayer.#lyricsExtensions.has(file.name.slice(index).toLowerCase());
	}

	static #keyLyrics(id: string): string {
		return `${id}.lrc`;
	}

	static async #probeDuration(file: File): Promise<number> {
		const probe = new Audio();
		const url = URL.createObjectURL(file);
		try {
			await Promise.withSignal((signal, resolve, reject) => {
				probe.addEventListener("loadedmetadata", event => resolve(), { signal });
				probe.addEventListener("error", event => reject(new Error(`Failed to read metadata for '${file.name}'`)), { signal });
				probe.src = url;
			});
			return probe.duration.insteadNaN(0);
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	async #load(track: Track | null): Promise<void> {
		const audioPlayer = this.#audioPlayer;
		if (!String.isEmpty(audioPlayer.src)) {
			URL.revokeObjectURL(audioPlayer.src);
		}

		if (track === null) {
			audioPlayer.removeAttribute("src");
			audioPlayer.srcObject = null;
			this.dispatchEvent(new CustomEvent("track", { detail: null }));
			return;
		}

		const file = await this.#store.get(track.id);
		if (!(file instanceof File)) throw new Error(`Missing audio data for track '${track.signature}'`);
		const url = URL.createObjectURL(file);
		await Promise.withSignal((signal, resolve, reject) => {
			audioPlayer.addEventListener("canplay", event => resolve(), { signal });
			audioPlayer.addEventListener("error", event => reject(new Error(`Failed to load audio file '${track.signature}'`)), { signal });
			audioPlayer.src = url;
		});
		this.dispatchEvent(new CustomEvent("track", { detail: track }));
	}

	async #play(): Promise<void> {
		try {
			await this.#audioPlayer.play();
		} catch (reason) {
			const error = Error.from(reason);
			if (error.name !== "NotAllowedError") throw error;
		}
	}

	#emitChange(): void {
		this.dispatchEvent(new Event("change"));
	}

	async #persist(): Promise<void> {
		if (this.#playlist.hasPending) return;
		await this.#cell.save(500);
	}

	#notify(): void {
		this.#emitChange();
		void this.#persist();
	}

	async #commit(track: Track | null, resume: boolean): Promise<void> {
		this.#emitChange();
		await this.#load(track);
		if (resume && track !== null) await this.#play();
		else this.#audioPlayer.pause();
		void this.#persist();
	}

	async #adoptLegacy(playlist: Playlist): Promise<void> {
		if (!playlist.isEmpty) return;
		const store = this.#store;
		const legacy = await store.get(0);
		if (!(legacy instanceof File)) return;

		const id = crypto.randomUUID();
		const signature = Track.probeSignature(legacy.name);
		const duration = await PlaylistPlayer.#probeDuration(legacy);
		await store.put(id, legacy);
		await store.delete(0);
		playlist.append(new Track(id, signature, duration));
		playlist.index = 0;
	}

	async restore(): Promise<void> {
		const playlist = this.#playlist;
		const store = this.#store;

		await this.#adoptLegacy(playlist);

		const ids = new Set(playlist.tracks.map(track => track.id));
		for (const key of await store.keys()) {
			const name = String(key);
			let id = name;
			if (name.endsWith(".lrc")) id = name.slice(0, -".lrc".length);
			if (ids.has(id)) continue;
			await store.delete(key);
		}

		void this.#persist();
		await this.#load(playlist.current);
		this.#emitChange();
	}

	async readLyrics(track: Track): Promise<string | null> {
		const value = await this.#store.get(PlaylistPlayer.#keyLyrics(track.id));
		if (value === undefined) return null;
		const text = String(value);
		// ponytail: repairs the lyrics badge for rows written before the flag existed, or poisoned by a past failed lookup
		const hasLyrics = !String.isEmpty(text);
		if (track.lyrics !== hasLyrics) {
			track.lyrics = hasLyrics;
			this.#notify();
		}
		return text;
	}

	async setLyrics(track: Track, text: string, checked: number | null): Promise<void> {
		await this.#store.put(PlaylistPlayer.#keyLyrics(track.id), text);
		track.lyrics = !String.isEmpty(text);
		track.checked = checked;
		this.#notify();
	}

	#appendPending(files: readonly File[]): Map<Track, File> {
		const playlist = this.#playlist;
		const imports = new Map<Track, File>();
		for (const file of files) {
			const track = Track.pending(file.name);
			playlist.append(track);
			imports.set(track, file);
		}
		return imports;
	}

	async #import(track: Track, file: File): Promise<Error | null> {
		try {
			const duration = await PlaylistPlayer.#probeDuration(file);
			await this.#store.put(track.id, file);
			track.resolve(duration);
			return null;
		} catch (reason) {
			this.#playlist.remove(track.id);
			return Error.from(reason);
		} finally {
			this.#emitChange();
		}
	}

	async #drain(imports: ReadonlyMap<Track, File>): Promise<Error | null> {
		let failure: Error | null = null;
		for (const [track, file] of imports) {
			const reason = await this.#import(track, file);
			if (reason === null) continue;
			if (failure !== null) continue;
			failure = reason;
		}
		return failure;
	}

	async #attachLyrics(files: readonly File[]): Promise<void> {
		for (const file of files) {
			const signature = Track.probeSignature(file.name);
			const track = this.#playlist.tracks.find(track => track.signature === signature);
			if (track === undefined) continue;
			await this.setLyrics(track, await file.text(), null);
		}
	}

	async #preselect(wasEmpty: boolean): Promise<void> {
		if (!wasEmpty) return;
		const playlist = this.#playlist;
		if (playlist.isEmpty) return;
		playlist.index = 0;
		this.#emitChange();
		await this.#load(playlist.current);
	}

	async add(source: Iterable<File>): Promise<void> {
		const files = Array.from(source);
		const wasEmpty = this.#playlist.isEmpty;

		const imports = this.#appendPending(files.filter(file => !PlaylistPlayer.#isLyricsFile(file)));
		this.#emitChange();

		const failure = await this.#drain(imports);
		await this.#attachLyrics(files.filter(file => PlaylistPlayer.#isLyricsFile(file)));
		await this.#preselect(wasEmpty);

		this.#emitChange();
		void this.#persist();

		if (failure === null) return;
		throw failure;
	}

	async remove(id: string): Promise<void> {
		const playlist = this.#playlist;
		const { current } = playlist;
		let wasCurrent = false;
		if (current !== null) wasCurrent = current.matches(id);
		if (!playlist.remove(id)) return;
		this.#emitChange();

		const store = this.#store;
		await store.delete(id);
		await store.delete(PlaylistPlayer.#keyLyrics(id));
		if (wasCurrent) await this.#load(playlist.current);
		void this.#persist();
	}

	move(from: number, to: number): void {
		if (!this.#playlist.move(from, to)) return;
		this.#notify();
	}

	async activate(index: number): Promise<void> {
		const track = this.#playlist.select(index);
		if (track === null) return;
		await this.#commit(track, true);
	}

	async advance(): Promise<Track | null> {
		const track = this.#playlist.advance();
		await this.#commit(track, track !== null);
		return track;
	}

	async skip(): Promise<void> {
		const wasPlaying = !this.#audioPlayer.paused;
		const track = this.#playlist.skip();
		if (track === null) return;
		await this.#commit(track, wasPlaying);
	}

	async retreat(): Promise<void> {
		const wasPlaying = !this.#audioPlayer.paused;
		const track = this.#playlist.retreat();
		if (track === null) return;
		await this.#commit(track, wasPlaying);
	}

	nextMode(): PlaybackMode {
		const mode = this.#playlist.nextMode();
		this.#notify();
		return mode;
	}
}
//#endregion
