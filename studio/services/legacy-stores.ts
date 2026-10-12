"use strict";

import "adaptive-extender/web";
import { type Store } from "adaptive-extender/web";

//#region Legacy backgrounds
/**
 * Moves the background images out of the separate `Visualizer\Backgrounds` database into the `Backgrounds` table of the `Visualizer` database.
 * @deprecated Migration only. Remove once no browser keeps the old database.
 */
export class LegacyBackgrounds {
	static #database: string = "Visualizer\\Backgrounds";
	static #table: string = "Images";
	static #prefix: string = "background:";

	static async #exists(): Promise<boolean> {
		const database = LegacyBackgrounds.#database;
		const databases = await indexedDB.databases();
		return databases.some(info => info.name === database);
	}

	static async #drop(): Promise<void> {
		const request = indexedDB.deleteDatabase(LegacyBackgrounds.#database);
		await Promise.withSignal((signal, resolve, reject) => {
			request.addEventListener("success", event => resolve(), { signal });
			request.addEventListener("error", event => reject(request.error), { signal });
		});
	}

	static async migrate(target: Store<string>): Promise<void> {
		if (!await LegacyBackgrounds.#exists()) return;
		const prefix = LegacyBackgrounds.#prefix;
		const source: Store<string> = indexedDB.openStore(LegacyBackgrounds.#database, LegacyBackgrounds.#table);
		const entries: (readonly [string, unknown])[] = [];
		for (const [key, value] of await source.select()) {
			if (!key.startsWith(prefix)) continue;
			const name = key.slice(prefix.length);
			if (await target.select(name) !== null) continue;
			entries.push([name, value]);
		}
		await target.insert(entries);
		await LegacyBackgrounds.#drop();
	}
}
//#endregion
