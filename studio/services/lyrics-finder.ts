"use strict";

import "adaptive-extender/web";
import { LrclibResult } from "../models/lrclib-result.js";

//#region Lyrics finder
// ponytail: matches on the bare filename and a duration window; add artist/title tag parsing if the hit rate is bad
export class LyricsFinder {
	static #tolerance = 5;
	static #cooldown = 5000;
	static #blockedUntil = 0;

	static async find(signature: string, duration: number, signal: AbortSignal): Promise<string | null> {
		if (Date.now() < LyricsFinder.#blockedUntil) throw new Error("lrclib search is cooling down after a recent failure");

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

			LyricsFinder.#blockedUntil = 0;
			if (best === null || bestGap > LyricsFinder.#tolerance) return null;
			return best;
		} catch (reason) {
			if (!signal.aborted) LyricsFinder.#blockedUntil = Date.now() + LyricsFinder.#cooldown;
			throw reason;
		}
	}
}
//#endregion
