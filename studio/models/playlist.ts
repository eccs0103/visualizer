"use strict";

import "adaptive-extender/core";
import { Model, Field, Enum, Random, Timespan } from "adaptive-extender/core";

//#region Track
export class Track extends Model {
	@Field(String, { name: "id" })
	id: string;

	@Field(String, { name: "signature" })
	signature: string;

	@Field(Number, { name: "duration" })
	duration: number;

	constructor();
	constructor(id: string, signature: string, duration: number);
	constructor(id?: string, signature?: string, duration?: number) {
		if (id === undefined || signature === undefined || duration === undefined) {
			super();
			return;
		}

		super();
		this.id = id;
		this.signature = signature;
		this.duration = duration;
	}

	static toTimeString(seconds: number): string {
		const time = Timespan.fromComponents(0, 0, seconds);
		const minute = time.days * 24 + time.hours * 60 + time.minutes;
		const second = time.seconds;
		return `${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`;
	}

	static probeSignature(name: string): string {
		const index = name.lastIndexOf(".");
		if (index < 1) return name;
		return name.slice(0, index);
	}

	toDurationString(): string {
		return Track.toTimeString(this.duration);
	}

	matches(id: string): boolean {
		return this.id === id;
	}
}
//#endregion
//#region Reorder
export class Reorder {
	from: number;
	to: number;

	constructor(from: number, to: number) {
		this.from = from;
		this.to = to;
	}

	get isEffective(): boolean {
		return this.from !== this.to;
	}
}
//#endregion
//#region Playlist
export enum PlaybackMode {
	once = "once",
	one = "one",
	loop = "loop",
	shuffle = "shuffle",
}

export class Playlist extends Model {
	@Field(Array.Of(Track), { name: "tracks" })
	tracks: Track[] = [];

	@Field(Number, { name: "index" })
	index: number = -1;

	@Field(Enum.Of(PlaybackMode), { name: "mode" })
	mode: PlaybackMode = PlaybackMode.once;

	static #order: PlaybackMode[] = [PlaybackMode.one, PlaybackMode.once, PlaybackMode.loop, PlaybackMode.shuffle];

	#queue: string[] | null = null;

	get isEmpty(): boolean {
		return this.tracks.length < 1;
	}

	get current(): Track | null {
		const track = this.tracks[this.index];
		if (track === undefined) return null;
		return track;
	}

	#reshuffle(): void {
		const { current } = this;
		const ids = this.tracks.filter(track => current === null || !track.matches(current.id)).map(track => track.id);
		Random.global.shuffle(ids);
		this.#queue = ids;
	}

	#reindexAfterRemoval(position: number): void {
		if (position < this.index) this.index--;
		else if (position === this.index) this.index = Math.min(this.index, this.tracks.length - 1);
	}

	#reindexAfterMove(from: number, to: number): void {
		if (this.index === from) this.index = to;
		else if (from < this.index && to >= this.index) this.index--;
		else if (from > this.index && to <= this.index) this.index++;
	}

	append(track: Track): void {
		this.tracks.push(track);
		if (this.mode !== PlaybackMode.shuffle || this.#queue === null) return;
		const position = Random.global.integer(0, this.#queue.length);
		this.#queue.splice(position, 0, track.id);
	}

	remove(id: string): boolean {
		const position = this.tracks.findIndex(track => track.matches(id));
		if (position < 0) return false;
		this.tracks.splice(position, 1);
		this.#reindexAfterRemoval(position);
		if (this.#queue !== null) this.#queue.remove(id);
		return true;
	}

	move(from: number, to: number): boolean {
		const { tracks } = this;
		if (from < 0 || from >= tracks.length || to < 0 || to >= tracks.length || from === to) return false;
		const [track] = tracks.splice(from, 1);
		tracks.splice(to, 0, track);
		this.#reindexAfterMove(from, to);
		return true;
	}

	select(index: number): Track | null {
		if (index < 0 || index >= this.tracks.length) return null;
		this.index = index;
		if (this.#queue !== null) this.#queue.remove(this.tracks[index].id);
		return this.current;
	}

	cycleMode(): PlaybackMode {
		const order = Playlist.#order;
		const position = order.indexOf(this.mode);
		this.mode = order[(position + 1) % order.length];
		this.#queue = null;
		return this.mode;
	}

	#repeat(): Track | null {
		if (this.index < 0) this.index = 0;
		return this.current;
	}

	#continue(): Track | null {
		if (this.index < 0) { this.index = 0; return this.current; }
		if (this.index + 1 >= this.tracks.length) return null;
		this.index++;
		return this.current;
	}

	#cycle(): Track | null {
		if (this.index < 0) this.index = 0;
		else this.index = (this.index + 1) % this.tracks.length;
		return this.current;
	}

	#draw(): Track | null {
		if (this.#queue === null) this.#reshuffle();
		const queue = ReferenceError.suppress(this.#queue, "Playback queue failed to seed");
		while (queue.length > 0) {
			const id = ReferenceError.suppress(queue.shift(), "Playback queue entry missing");
			const position = this.tracks.findIndex(track => track.matches(id));
			if (position >= 0) {
				this.index = position;
				return this.current;
			}
		}
		return null;
	}

	advance(): Track | null {
		if (this.isEmpty) return null;
		switch (this.mode) {
		case PlaybackMode.one: return this.#repeat();
		case PlaybackMode.once: return this.#continue();
		case PlaybackMode.loop: return this.#cycle();
		case PlaybackMode.shuffle: return this.#draw();
		default: throw new TypeError(`Invalid '${this.mode}' playback mode`);
		}
	}

	skip(): Track | null {
		if (this.isEmpty) return null;
		return this.#cycle();
	}

	retreat(): Track | null {
		if (this.isEmpty) return null;
		if (this.index <= 0) this.index = this.tracks.length - 1;
		else this.index--;
		return this.current;
	}
}
//#endregion
