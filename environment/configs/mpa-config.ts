"use strict";

import "adaptive-extender/node";
import { ViteConfig } from "./vite-config.js";
import { VitePlugin } from "../plugins/vite-plugin.js";

//#region MPA config
export class MPAConfig extends ViteConfig {
	static #lock: boolean = true;

	constructor(inputs: readonly URL[], rootEntries: readonly URL[], pathEntries: readonly URL[], output: URL, plugins: readonly VitePlugin[]) {
		super(inputs, rootEntries, pathEntries, output, plugins);
		if (MPAConfig.#lock) throw new TypeError("Illegal constructor");
	}

	static async construct(inputs: readonly URL[], rootEntries: readonly URL[], pathEntries: readonly URL[], output: URL, plugins: readonly VitePlugin[] = []): Promise<MPAConfig> {
		MPAConfig.#lock = false;
		const config = new MPAConfig(inputs, rootEntries, pathEntries, output, plugins);
		MPAConfig.#lock = true;
		return config;
	}
}
//#endregion
