"use strict";

import { defineConfig } from "vite";
import { type ViteConfig } from "./environment/configs/vite-config.js";
import { DefaultMPAConfig } from "./environment/configs/default-mpa-config.js";

const root: URL = new URL(import.meta.url);
const inputs: URL[] = [
	new URL("./index.html", root),
	new URL("./studio/index.html", root),
];
const rootEntries: URL[] = [
	new URL("./environment/controllers/coi-worker.ts", root)
];
const pathEntries: URL[] = [
	new URL("./studio/controllers/audio-analyzer-worker.ts", root)
];
const output: URL = new URL("./dist", root);
const config: ViteConfig = await DefaultMPAConfig.construct(inputs, rootEntries, pathEntries, output);
export default defineConfig(config.build());
