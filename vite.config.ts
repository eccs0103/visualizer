"use strict";

import { defineConfig } from "vite";
import { type ViteConfig } from "./environment/configs/vite-config.js";
import { MPAConfig } from "./environment/configs/mpa-config.js";
import { CloudflareVitePlugin } from "./environment/plugins/cloudflare-vite-plugin.js";
import { type VitePlugin } from "./environment/plugins/vite-plugin.js";

const root: URL = new URL(import.meta.url);
const inputs: URL[] = [
	new URL("./index.html", root),
	new URL("./studio/index.html", root),
];
const rootEntries: URL[] = [
	new URL("./environment/controllers/coi-worker.ts", root)
];
const pathEntries: URL[] = [
	new URL("./studio/controllers/audio-analyzer-worker.ts", root),
	new URL("./studio/controllers/visualization-worker.ts", root),
	new URL("./studio/services/clip-accumulator-worker.ts", root),
];
const output: URL = new URL("./dist", root);
const plugins: VitePlugin[] = [new CloudflareVitePlugin()];
const config: ViteConfig = await MPAConfig.construct(inputs, rootEntries, pathEntries, output, plugins);
export default defineConfig(config.build());
