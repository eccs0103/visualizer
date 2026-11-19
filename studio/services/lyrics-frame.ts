"use strict";

import "adaptive-extender/worker";
import { type LyricsWindow } from "../models/visualization.js";

const { min, max } = Math;

//#region Lyrics frame
export class LyricsFrame implements LyricsWindow {
	#previous: string | null = null;
	#current: string | null = null;
	#next: string | null = null;
	#begin: number | null = null;
	#end: number | null = null;
	#shake: number = 0.2;
	#position: number | null = null;

	get previous(): string | null { return this.#previous; }
	get current(): string | null { return this.#current; }
	get next(): string | null { return this.#next; }
	get shake(): number { return this.#shake; }
	set shake(value: number) { this.#shake = value; }
	get isEmpty(): boolean { return this.#previous === null && this.#current === null && this.#next === null; }

	get progress(): number | null {
		const begin = this.#begin;
		const end = this.#end;
		const position = this.#position;
		if (begin === null || end === null || position === null) return null;
		return min(1, max(0, position - begin) / (end - begin));
	}

	update(previous: string | null, current: string | null, next: string | null, begin: number | null, end: number | null): void {
		this.#previous = previous;
		this.#current = current;
		this.#next = next;
		this.#begin = begin;
		this.#end = end;
	}

	tick(position: number): void {
		this.#position = position;
	}
}
//#endregion
