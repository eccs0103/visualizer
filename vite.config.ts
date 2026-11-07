"use strict";

import "adaptive-extender/node";
import { URI } from "adaptive-extender/node";
import { defineConfig } from "vite";
import { type OutgoingHttpHeaders } from "node:http";
import { type ViteConfig } from "./environment/configs/vite-config.js";
import { MPAConfig } from "./environment/configs/mpa-config.js";
import { CloudflareVitePlugin } from "./environment/plugins/cloudflare-vite-plugin.js";
import { type VitePlugin } from "./environment/plugins/vite-plugin.js";

export default defineConfig(async (env) => {
	const root: URI = new URI(import.meta.url);
	const inputs: URI[] = [
		new URI("./studio/index.html", root)
	];
	const rootEntries: URI[] = [
		new URI("./environment/controllers/coi-worker.ts", root)
	];
	const pathEntries: URI[] = [
		new URI("./studio/controllers/visualization-worker.ts", root),
		new URI("./studio/controllers/stem-mask-worker.ts", root),
		new URI("./studio/controllers/clip-accumulator-worker.ts", root),
	];
	const output: URI = new URI("./dist/client", root);
	const plugins: VitePlugin[] = [new CloudflareVitePlugin()];
	const headers: OutgoingHttpHeaders = {
		["Cross-Origin-Opener-Policy"]: "same-origin",
		["Cross-Origin-Embedder-Policy"]: "require-corp",
	};
	const config: ViteConfig = await MPAConfig.construct(inputs, rootEntries, pathEntries, output, plugins, headers);
	return config.build();
});
