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

	static #probeSignature(name: string): string {
		const index = name.lastIndexOf(".");
		if (index < 1) return name;
		return name.slice(0, index);
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

	#notify(): void {
		this.dispatchEvent(new Event("change"));
		void this.#cell.save(500);
	}

	async #commit(track: Track | null, resume: boolean): Promise<void> {
		this.dispatchEvent(new Event("change"));
		await this.#load(track);
		if (resume && track !== null) await this.#play();
		else this.#audioPlayer.pause();
		void this.#cell.save(500);
	}

	async #migrateLegacy(playlist: Playlist): Promise<void> {
		if (!playlist.isEmpty) return;
		const legacy = await this.#store.get(0);
		if (!(legacy instanceof File)) return;

		const id = crypto.randomUUID();
		const signature = PlaylistPlayer.#probeSignature(legacy.name);
		const duration = await PlaylistPlayer.#probeDuration(legacy);
		await this.#store.put(id, legacy);
		await this.#store.delete(0);
		playlist.append(new Track(id, signature, duration));
		playlist.index = 0;
	}

	async restore(): Promise<void> {
		const playlist = this.#playlist;
		const store = this.#store;

		await this.#migrateLegacy(playlist);

		const ids = new Set(playlist.tracks.map(track => track.id));
		for (const key of await store.keys()) {
			if (ids.has(String(key))) continue;
			await store.delete(key);
		}

		void this.#cell.save(500);
		await this.#load(playlist.current);
		this.dispatchEvent(new Event("change"));
	}

	async add(files: Iterable<File>): Promise<void> {
		const playlist = this.#playlist;
		const store = this.#store;
		const wasEmpty = playlist.isEmpty;

		for (const file of files) {
			const id = crypto.randomUUID();
			const signature = PlaylistPlayer.#probeSignature(file.name);
			const duration = await PlaylistPlayer.#probeDuration(file);
			await store.put(id, file);
			playlist.append(new Track(id, signature, duration));
		}

		if (wasEmpty && !playlist.isEmpty) playlist.index = 0;
		this.dispatchEvent(new Event("change"));

		if (wasEmpty && !playlist.isEmpty) await this.#load(playlist.current);
		await this.#cell.save(500);
	}

	async remove(id: string): Promise<void> {
		const playlist = this.#playlist;
		const { current } = playlist;
		let wasCurrent = false;
		if (current !== null) wasCurrent = current.matches(id);
		if (!playlist.remove(id)) return;
		this.dispatchEvent(new Event("change"));

		await this.#store.delete(id);
		if (wasCurrent) await this.#load(playlist.current);
		void this.#cell.save(500);
	}

	move(from: number, to: number): void {
		this.#playlist.move(from, to);
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

	cycleMode(): PlaybackMode {
		const mode = this.#playlist.cycleMode();
		this.#notify();
		return mode;
	}
}
//#endregion
