"use strict";

import "adaptive-extender/core";
import { Model, Field, Nullable } from "adaptive-extender/core";

const { abs } = Math;

//#region Lrclib result
export class LrclibResult extends Model {
	@Field(Number, { name: "duration" })
	duration: number;

	@Field(Boolean, { name: "instrumental" })
	instrumental: boolean;

	@Field(Nullable.Of(String), { name: "syncedLyrics" })
	lyrics: string | null;

	constructor();
	constructor(duration: number, instrumental: boolean, lyrics: string | null);
	constructor(duration?: number, instrumental?: boolean, lyrics?: string | null) {
		if (duration === undefined || instrumental === undefined || lyrics === undefined) {
			super();
			return;
		}

		super();
		this.duration = duration;
		this.instrumental = instrumental;
		this.lyrics = lyrics;
	}

	get isSynced(): boolean {
		return !this.instrumental && this.lyrics !== null;
	}

	gap(duration: number): number {
		return abs(this.duration - duration);
	}
}
//#endregion
