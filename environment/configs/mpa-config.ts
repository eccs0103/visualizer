"use strict";

import "adaptive-extender/node";
import { type URI } from "adaptive-extender/node";
import { ViteConfig } from "./vite-config.js";
import { WebConfig } from "./web-config.js";
import { type VitePlugin } from "../plugins/vite-plugin.js";
import { type OutgoingHttpHeaders } from "node:http";

//#region MPA config
export class MPAConfig extends WebConfig {
	static #lock: boolean = true;

	constructor(inputs: readonly URI[], rootEntries: readonly URI[], pathEntries: readonly URI[], output: URI, plugins: readonly VitePlugin[], headers: Readonly<OutgoingHttpHeaders>) {
		super(MPAConfig.#normalizeInputs(inputs), "mpa", rootEntries, pathEntries, output, plugins, headers);
		if (MPAConfig.#lock) throw new TypeError("Illegal constructor");
	}

	static #normalizeInputs(inputs: readonly URI[]): Record<string, string> {
		const { root } = WebConfig;
		const pages: Record<string, string> = {};
		for (const uri of inputs) {
			let name = ViteConfig.relative(uri, root);
			if (name === "index") name = "main";
			if (name.endsWith("/index")) name = name.slice(0, -6);
			pages[name] = uri.toPath();
		}
		return pages;
	}

	static async construct(inputs: readonly URI[], rootEntries: readonly URI[], pathEntries: readonly URI[], output: URI, plugins: readonly VitePlugin[] = [], headers: Readonly<OutgoingHttpHeaders> = {}): Promise<MPAConfig> {
		MPAConfig.#lock = false;
		const config = new MPAConfig(inputs, rootEntries, pathEntries, output, plugins, headers);
		MPAConfig.#lock = true;
		return config;
	}
}
//#endregion
