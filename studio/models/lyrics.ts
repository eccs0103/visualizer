"use strict";

import "adaptive-extender/core";

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

	lines: LyricLine[];

	constructor(lines: LyricLine[]) {
		this.lines = lines;
	}

	static parse(text: string): Lyrics {
		const patternTimestamp = Lyrics.#patternTimestamp;
		const offsetMatch = Lyrics.#patternOffset.exec(text);
		let offset = 0;
		if (offsetMatch !== null) offset = Number(offsetMatch[1]) / 1000;

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

		lines.sort((first, second) => first.time - second.time);
		return new Lyrics(lines);
	}

	get isEmpty(): boolean {
		return this.lines.length < 1;
	}

	at(seconds: number): number {
		return this.lines.findLastIndex(line => line.time <= seconds);
	}
}
//#endregion
