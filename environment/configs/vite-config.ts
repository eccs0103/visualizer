"use strict";

import "adaptive-extender/node";
import { type InputOption, type OutputOptions, type PreRenderedChunk, type RollupOptions } from "rollup";
import { type AppType, type BuildEnvironmentOptions, type ESBuildOptions, type PreviewOptions, type ServerOptions, type UserConfig } from "vite";
import { VitePlugin } from "../plugins/vite-plugin.js";
import { type OutgoingHttpHeaders } from "node:http";
import { fileURLToPath } from "node:url";

//#region Vite config
export class ViteConfig {
	#inputs: readonly URL[];
	#directs: readonly URL[];
	#relativeDirects: readonly URL[];
	#output: URL;
	#plugins: readonly VitePlugin[];

	constructor(inputs: readonly URL[], directs: readonly URL[], relativeDirects: readonly URL[], output: URL, plugins: readonly VitePlugin[]) {
		this.#inputs = inputs;
		this.#directs = directs;
		this.#relativeDirects = relativeDirects;
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

	#normalizeServiceWorkers(): Record<string, string> {
		const entries: Record<string, string> = {};
		for (const url of this.#directs) {
			const path = fileURLToPath(url);
			const filename = path.replace(/\\/g, "/").split("/").pop()!;
			const name = filename.replace(/\.[^/.]+$/, String.empty);
			entries[name] = path;
		}
		return entries;
	}

	#normalizeRelativeDirects(): Record<string, string> {
		const root = `${process.cwd().replace(/\\/g, "/")}/`;
		const entries: Record<string, string> = {};
		for (const url of this.#relativeDirects) {
			const input = fileURLToPath(url);
			const path = input.replace(/\\/g, "/");
			const name = path.replace(root, String.empty).replace(/\.[^/.]+$/, String.empty);
			entries[name] = input;
		}
		return entries;
	}

	#entryFileNames(names: Set<string>, chunk: PreRenderedChunk): string {
		if (names.has(chunk.name)) return "[name].js";
		return "assets/[name]-[hash].js";
	}

	#buildOutput(names: Set<string>): OutputOptions {
		const entryFileNames = this.#entryFileNames.bind(this, names);
		return { entryFileNames };
	}

	#buildRollupOptions(): RollupOptions {
		const recordInputs = this.#normalizeInputs();
		const recordServiceWorkers = this.#normalizeServiceWorkers();
		const recordRelativeDirects = this.#normalizeRelativeDirects();
		const input: InputOption = { ...recordInputs, ...recordServiceWorkers, ...recordRelativeDirects };
		const names = new Set([...Object.keys(recordServiceWorkers), ...Object.keys(recordRelativeDirects)]);
		const output: OutputOptions = this.#buildOutput(names);
		return { input, output };
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

	#buildWorker(): { format?: "es"; } {
		const format = "es" as const;
		return { format };
	}

	#buildPreview(): PreviewOptions {
		const headers: OutgoingHttpHeaders = this.#buildOutgoingHeaders();
		return { headers };
	}

	build(): UserConfig {
		const base: string = "./";
		const appType: AppType = "mpa";
		const publicDir: string = "resources";
		const build: BuildEnvironmentOptions = this.#buildEnvironment();
		const server: ServerOptions = this.#buildServer();
		const preview: PreviewOptions = this.#buildPreview();
		const esbuild: ESBuildOptions = this.#buildESBuild();
		const worker = this.#buildWorker();
		const plugins = this.#plugins.map(plugin => plugin.build());
		return { base, appType, publicDir, build, server, preview, esbuild, worker, plugins };
	}
}
//#endregion
