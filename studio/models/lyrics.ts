"use strict";

import "adaptive-extender/core";
import { Nullable } from "adaptive-extender/core";

const { min } = Math;

//#region Lyric line
export class LyricLine {
	time: number;
	text: string;

	constructor(time: number, text: string) {
		this.time = time;
		this.text = text;
	}
}
//#endregion
//#region Lyrics
export class Lyrics {
	static #patternTimestamp = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
	static #patternOffset = /\[offset:\s*(-?\d+)\]/i;
	static #patternWordTiming = /<\d+:\d+(?:\.\d+)?>/g;
	static #gap: number = 8;

	lines: LyricLine[];
	#rate: number | null;

	constructor(lines: LyricLine[]) {
		this.lines = lines;
		this.#rate = Lyrics.#measure(lines);
	}

	static #measure(lines: readonly LyricLine[]): number | null {
		const rates: number[] = [];
		for (const [index, line] of lines.entries()) {
			const next = lines[index + 1];
			if (next === undefined) break;
			const slot = next.time - line.time;
			if (line.text.length > 0 && slot > 0 && slot <= Lyrics.#gap) rates.push(line.text.length / slot);
		}
		if (rates.length === 0) return null;
		rates.sort((rate, rate2) => rate - rate2);
		return rates[rates.length >> 1] ?? null;
	}

	static parse(text: string): Lyrics {
		const patternTimestamp = Lyrics.#patternTimestamp;
		const match = Lyrics.#patternOffset.exec(text);
		let offset = 0;
		if (match !== null) offset = Number(match[1]) / 1000;

		const lines: LyricLine[] = [];
		for (const raw of text.split(/\r?\n/)) {
			const timestamps = Array.from(raw.matchAll(patternTimestamp));
			if (timestamps.length < 1) continue;

			const content = raw.replace(patternTimestamp, String.empty).replace(Lyrics.#patternWordTiming, String.empty).trim();
			for (const [, minutes, seconds] of timestamps) {
				const time = Number(minutes) * 60 + Number(seconds) - offset;
				lines.push(new LyricLine(time, content));
			}
		}

		lines.sort((line, line2) => line.time - line2.time);
		return new Lyrics(lines);
	}

	at(seconds: number): number {
		return this.lines.findLastIndex(line => line.time <= seconds);
	}

	line(index: number): string | null {
		return Nullable.map(this.lines[index] ?? null, line => line.text);
	}

	time(index: number): number | null {
		return Nullable.map(this.lines[index] ?? null, line => line.time);
	}

	end(index: number): number | null {
		const line = this.lines[index];
		if (line === undefined) return null;
		const next = this.lines[index + 1];
		const rate = this.#rate;
		if (line.text.length === 0 || rate === null) return Nullable.map(next ?? null, entry => entry.time);
		if (next !== undefined && next.time - line.time <= Lyrics.#gap) return next.time;
		const span = line.text.length / rate;
		if (next === undefined) return line.time + span;
		return line.time + min(next.time - line.time, span);
	}
}
//#endregion
