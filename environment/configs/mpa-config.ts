"use strict";

import "adaptive-extender/node";
import { ViteConfig } from "./vite-config.js";
import { VitePlugin } from "../plugins/vite-plugin.js";
import { type OutgoingHttpHeaders } from "node:http";

//#region MPA config
export class MPAConfig extends ViteConfig {
	static #lock: boolean = true;

	constructor(inputs: readonly URL[], rootEntries: readonly URL[], pathEntries: readonly URL[], output: URL, plugins: readonly VitePlugin[], headers: Readonly<OutgoingHttpHeaders>) {
		super(inputs, rootEntries, pathEntries, output, plugins, headers);
		if (MPAConfig.#lock) throw new TypeError("Illegal constructor");
	}

	static async construct(inputs: readonly URL[], rootEntries: readonly URL[], pathEntries: readonly URL[], output: URL, plugins: readonly VitePlugin[] = [], headers: Readonly<OutgoingHttpHeaders> = {}): Promise<MPAConfig> {
		MPAConfig.#lock = false;
		const config = new MPAConfig(inputs, rootEntries, pathEntries, output, plugins, headers);
		MPAConfig.#lock = true;
		return config;
	}
}
//#endregion
