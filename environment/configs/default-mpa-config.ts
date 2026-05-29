"use strict";

import "adaptive-extender/node";
import { ViteConfig } from "./vite-config.js";
import { VitePlugin } from "../plugins/vite-plugin.js";

//#region Default MPA config
export class DefaultMPAConfig extends ViteConfig {
	static #lock: boolean = true;

	constructor(inputs: readonly URL[], directs: readonly URL[], output: URL, plugins: readonly VitePlugin[]) {
		super(inputs, directs, output, plugins);
		if (DefaultMPAConfig.#lock) throw new TypeError("Illegal constructor");
	}

	static async construct(inputs: readonly URL[], directs: readonly URL[], output: URL): Promise<DefaultMPAConfig> {
		DefaultMPAConfig.#lock = false;
		const config = new DefaultMPAConfig(inputs, directs, output, []);
		DefaultMPAConfig.#lock = true;
		return config;
	}
}
//#endregion
