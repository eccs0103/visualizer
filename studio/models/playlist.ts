"use strict";

import "adaptive-extender/core";
import { Model, Field, Enum, Random } from "adaptive-extender/core";

//#region Track
export class Track extends Model {
	@Field(String, { name: "id" })
	id: string;

	@Field(String, { name: "name" })
	name: string;

	@Field(Number, { name: "duration" })
	duration: number = 0;

	constructor();
	constructor(id: string, name: string, duration: number);
	constructor(id?: string, name?: string, duration?: number) {
		if (id === undefined || name === undefined || duration === undefined) {
			super();
			return;
		}

		super();
		this.id = id;
		this.name = name;
		this.duration = duration;
	}

	get title(): string {
		const index = this.name.lastIndexOf(".");
		if (index < 1) return this.name;
		return this.name.slice(0, index);
	}
}
//#endregion
//#region Playlist
export enum PlaybackMode {
	off = "off",
	loopOne = "loop_one",
	loopAll = "loop_all",
	shuffle = "shuffle",
}

export class Playlist extends Model {
	@Field(Array.Of(Track), { name: "tracks" })
	tracks: Track[] = [];

	@Field(Number, { name: "index" })
	index: number = -1;

	@Field(Enum.Of(PlaybackMode), { name: "mode" })
	mode: PlaybackMode = PlaybackMode.off;

	#queue: number[] = [];

	get count(): number {
		return this.tracks.length;
	}

	get isEmpty(): boolean {
		return this.tracks.length < 1;
	}

	get current(): Track | null {
		const track = this.tracks[this.index];
		if (track === undefined) return null;
		return track;
	}

	#reshuffle(): void {
		const indexes = Array.range(0, this.tracks.length).filter(value => value !== this.index);
		Random.global.shuffle(indexes);
		this.#queue = indexes;
	}

	append(track: Track): void {
		this.tracks.push(track);
	}

	remove(id: string): Track | null {
		const position = this.tracks.findIndex(track => track.id === id);
		if (position < 0) return null;
		const [track] = this.tracks.splice(position, 1);

		if (position < this.index) this.index--;
		else if (position === this.index) this.index = Math.min(this.index, this.tracks.length - 1);

		this.#queue = this.#queue.filter(value => value !== position).map((value) => {
			if (value > position) return value - 1;
			return value;
		});

		return track;
	}

	move(from: number, to: number): void {
		const tracks = this.tracks;
		if (from < 0 || from >= tracks.length || to < 0 || to >= tracks.length || from === to) return;
		const [track] = tracks.splice(from, 1);
		tracks.splice(to, 0, track);

		if (this.index === from) this.index = to;
		else if (from < this.index && to >= this.index) this.index--;
		else if (from > this.index && to <= this.index) this.index++;
	}

	select(index: number): Track | null {
		if (index < 0 || index >= this.tracks.length) return null;
		this.index = index;
		return this.current;
	}

	cycleMode(): PlaybackMode {
		const order: readonly PlaybackMode[] = [PlaybackMode.off, PlaybackMode.loopOne, PlaybackMode.loopAll, PlaybackMode.shuffle];
		const position = order.indexOf(this.mode);
		this.mode = order[(position + 1) % order.length];
		if (this.mode === PlaybackMode.shuffle) this.#reshuffle();
		return this.mode;
	}

	advance(): Track | null {
		if (this.isEmpty) return null;
		switch (this.mode) {
		case PlaybackMode.loopOne: {
			if (this.index < 0) this.index = 0;
			return this.current;
		}
		case PlaybackMode.loopAll: {
			if (this.index < 0) this.index = 0;
			else this.index = (this.index + 1) % this.tracks.length;
			return this.current;
		}
		case PlaybackMode.shuffle: {
			const next = this.#queue.shift();
			if (next === undefined) return null;
			this.index = next;
			return this.current;
		}
		case PlaybackMode.off:
		default: {
			if (this.index < 0) { this.index = 0; return this.current; }
			if (this.index + 1 >= this.tracks.length) return null;
			this.index++;
			return this.current;
		}
		}
	}

	skip(): Track | null {
		if (this.isEmpty) return null;
		if (this.index < 0) this.index = 0;
		else this.index = (this.index + 1) % this.tracks.length;
		return this.current;
	}

	retreat(): Track | null {
		if (this.isEmpty) return null;
		if (this.index <= 0) this.index = this.tracks.length - 1;
		else this.index--;
		return this.current;
	}
}
//#endregion
