"use strict";

import "adaptive-extender/node";
import { ViteConfig } from "./vite-config.js";
import { VitePlugin } from "../plugins/vite-plugin.js";

//#region Default MPA config
export class DefaultMPAConfig extends ViteConfig {
	static #lock: boolean = true;

	constructor(inputs: readonly URL[], output: URL, plugins: readonly VitePlugin[], direct: readonly URL[]) {
		super(inputs, output, plugins, direct);
		if (DefaultMPAConfig.#lock) throw new TypeError("Illegal constructor");
	}

	static async construct(inputs: readonly URL[], output: URL, direct: readonly URL[]): Promise<DefaultMPAConfig> {
		DefaultMPAConfig.#lock = false;
		const config = new DefaultMPAConfig(inputs, output, [], direct);
		DefaultMPAConfig.#lock = true;
		return config;
	}
}
//#endregion
