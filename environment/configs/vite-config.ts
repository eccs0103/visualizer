"use strict";

import "adaptive-extender/node";
import { type URI } from "adaptive-extender/node";
import { type RollupOptions } from "rollup";
import { type BuildEnvironmentOptions, type ESBuildOptions, type UserConfig } from "vite";
import { type VitePlugin } from "../plugins/vite-plugin.js";

//#region Vite config
export class ViteConfig {
	#output: URI;
	#plugins: readonly VitePlugin[];
	#target: string;
	#transform: string;

	constructor(output: URI, plugins: readonly VitePlugin[], target: string, transform: string) {
		if (new.target === ViteConfig) throw new TypeError("Unable to create an instance of an abstract class");
		this.#output = output;
		this.#plugins = plugins;
		this.#target = target;
		this.#transform = transform;
	}

	static relative(entry: URI, root: string): string {
		const path = entry.toPath().replace(/\\/g, "/");
		return path.replace(root, String.empty).replace(/\.[^/.]+$/, String.empty);
	}

	buildEnvironment(rollupOptions: RollupOptions): BuildEnvironmentOptions {
		const outDir: string = this.#output.toPath();
		const emptyOutDir: boolean = true;
		const target: string = this.#target;
		return { outDir, emptyOutDir, target, rollupOptions };
	}

	#buildESBuild(): ESBuildOptions {
		const target: string = this.#transform;
		const keepNames: boolean = true;
		return { target, keepNames };
	}

	build(): UserConfig {
		const esbuild: ESBuildOptions = this.#buildESBuild();
		const plugins = this.#plugins.map(plugin => plugin.build());
		return { esbuild, plugins };
	}
}
//#endregion
