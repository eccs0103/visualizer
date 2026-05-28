"use strict";

import "adaptive-extender/node";
import { type InputOption, type RollupOptions } from "rollup";
import { type AppType, type BuildEnvironmentOptions, type ESBuildOptions, type ServerOptions, type UserConfig } from "vite";
import { VitePlugin } from "../plugins/vite-plugin.js";
import { type OutgoingHttpHeaders } from "node:http";
import { fileURLToPath } from "node:url";

//#region Vite config
export class ViteConfig {
	#inputs: readonly URL[];
	#output: URL;
	#plugins: readonly VitePlugin[];

	constructor(inputs: readonly URL[], output: URL, plugins: readonly VitePlugin[]) {
		this.#inputs = inputs;
		this.#output = output;
		this.#plugins = plugins;
	}

	#normalizeInputs(): Record<string, string> {
		const root = `${process.cwd().replace(/\\/g, "/")}/`;
		const inputs: Record<string, string> = {};
		for (const url of this.#inputs) {
			const input = fileURLToPath(url);
			const path = input.replace(/\\/g, "/");
			let name = path.replace(root, String.empty);
			name = name.replace(/\.[^/.]+$/, String.empty);
			if (name === "index") name = "main";
			if (name.endsWith("/index")) name = name.slice(0, -6);
			inputs[name] = input;
		}
		return inputs;
	}

	#buildRollupOptions(): RollupOptions {
		const input: InputOption = this.#normalizeInputs();
		return { input };
	}

	#buildEnvironment(): BuildEnvironmentOptions {
		const outDir: string = fileURLToPath(this.#output);
		const emptyOutDir: boolean = true;
		const target: string = "ES2022";
		const rollupOptions: RollupOptions = this.#buildRollupOptions();
		return { outDir, emptyOutDir, target, rollupOptions };
	}

	#buildOutgoingHeaders(): OutgoingHttpHeaders {
		return {
			["Cross-Origin-Opener-Policy"]: "same-origin",
			["Cross-Origin-Embedder-Policy"]: "require-corp",
		};
	}

	#buildServer(): ServerOptions {
		const open: boolean = true;
		const strictPort: boolean = true;
		const headers: OutgoingHttpHeaders = this.#buildOutgoingHeaders();
		return { open, strictPort, headers };
	}

	#buildESBuild(): ESBuildOptions {
		const target: string = "ES2022";
		const keepNames: boolean = true;
		return { target, keepNames };
	}

	build(): UserConfig {
		const base: string = "./";
		const appType: AppType = "mpa";
		const publicDir: string = "resources";
		const build: BuildEnvironmentOptions = this.#buildEnvironment();
		const server: ServerOptions = this.#buildServer();
		const esbuild: ESBuildOptions = this.#buildESBuild();
		const worker = { format: "es" as const };

		const plugins = this.#plugins.map(plugin => plugin.build());

		return { base, appType, publicDir, build, server, esbuild, worker, plugins };
	}
}
//#endregion
