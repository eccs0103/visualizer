"use strict";

import "adaptive-extender/web";
import { type Store, type PortableStore } from "adaptive-extender/web";
import { FileRow, TextRow } from "../models/rows.js";
import { type PlaylistPlayer } from "./playlist-player.js";

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

	static async migrate(target: PortableStore<typeof FileRow, "id">): Promise<void> {
		if (!await LegacyBackgrounds.#exists()) return;
		const prefix = LegacyBackgrounds.#prefix;
		const source: Store<string> = indexedDB.openStore(LegacyBackgrounds.#database, LegacyBackgrounds.#table);
		const rows: FileRow[] = [];
		for (const [key, value] of await source.select()) {
			if (!key.startsWith(prefix) || !(value instanceof Blob)) continue;
			const name = key.slice(prefix.length);
			if (await target.select(name) !== null) continue;
			rows.push(new FileRow(name, value));
		}
		await target.insert(rows);
		await LegacyBackgrounds.#drop();
	}
}
//#endregion
//#region Legacy audio
/**
 * Imports the single track of the one-track era, kept in the `Audiolist` table under the number key `0`, into the playlist.
 * @deprecated Migration only. Remove once no browser keeps a track under the key `0`.
 */
export class LegacyAudio {
	static #key: number = 0;

	static async migrate(legacy: Store<number>, player: PlaylistPlayer): Promise<void> {
		const key = LegacyAudio.#key;
		const file = await legacy.select(key);
		if (file === null) return;
		if (player.isEmpty && file instanceof File) await player.add([file]);
		await legacy.delete(key);
	}
}
//#endregion
//#region Legacy lyrics
/**
 * Moves the lyrics out of the `Audiolist` table, where they were kept under `<track id>.lrc`, into the `Lyrics` table under the track id.
 * @deprecated Migration only. Remove once no browser keeps lyrics in the `Audiolist` table.
 */
export class LegacyLyrics {
	static #suffix: string = ".lrc";

	static async migrate(audiolist: Store<string>, lyrics: PortableStore<typeof TextRow, "id">): Promise<void> {
		const suffix = LegacyLyrics.#suffix;
		const keys: string[] = [];
		const rows: TextRow[] = [];
		for (const [key, value] of await audiolist.select()) {
			if (typeof key !== "string" || !key.endsWith(suffix)) continue;
			keys.push(key);
			const id = key.slice(0, -suffix.length);
			if (await lyrics.select(id) !== null) continue;
			rows.push(new TextRow(id, String(value)));
		}
		if (keys.length < 1) return;
		await lyrics.insert(rows);
		await audiolist.delete(keys);
	}
}
//#endregion
//#region Legacy bare files
/**
 * Wraps the files that the `Audiolist` and `Backgrounds` tables kept as bare values under their keys into rows.
 * @deprecated Migration only. Remove once no browser keeps a bare file in these tables.
 */
export class LegacyBareFiles {
	static async migrate(source: Store<string>, target: PortableStore<typeof FileRow, "id">): Promise<void> {
		const rows: FileRow[] = [];
		for (const [key, value] of await source.select()) {
			if (typeof key !== "string" || !(value instanceof Blob)) continue;
			rows.push(new FileRow(key, value));
		}
		if (rows.length < 1) return;
		await target.update(rows);
	}
}
//#endregion
//#region Legacy bare texts
/**
 * Wraps the lyrics that the `Lyrics` table kept as bare values under the track id into rows.
 * @deprecated Migration only. Remove once no browser keeps a bare text in the `Lyrics` table.
 */
export class LegacyBareTexts {
	static async migrate(source: Store<string>, target: PortableStore<typeof TextRow, "id">): Promise<void> {
		const rows: TextRow[] = [];
		for (const [key, value] of await source.select()) {
			if (typeof key !== "string" || typeof value !== "string") continue;
			rows.push(new TextRow(key, value));
		}
		if (rows.length < 1) return;
		await target.update(rows);
	}
}
//#endregion
