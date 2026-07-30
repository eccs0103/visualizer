"use strict";

import "adaptive-extender/node";
import { type PluginOption } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePlugin } from "./vite-plugin.js";

//#region Cloudflare Vite plugin
export class CloudflareVitePlugin extends VitePlugin {
	constructor() {
		super("cloudflare");
	}

	build(): PluginOption {
		return cloudflare();
	}
}
//#endregion
