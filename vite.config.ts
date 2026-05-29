"use strict";

import { defineConfig } from "vite";
import { DefaultMPAConfig } from "./environment/configs/default-mpa-config.js";

const root = import.meta.url;
const inputs = [
	new URL("./index.html", root),
	new URL("./studio/index.html", root),
];
const directs = [
	new URL("./environment/controllers/coi-worker.ts", root)
];
const output = new URL("./dist", root);
const config = await DefaultMPAConfig.construct(inputs, directs, output);
export default defineConfig(config.build());
