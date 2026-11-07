"use strict";

import "adaptive-extender/node";
import { type URI } from "adaptive-extender/node";
import { type InputOption, type OutputOptions, type PreRenderedChunk, type RollupOptions } from "rollup";
import { type AppType, type BuildEnvironmentOptions, type EnvironmentOptions, type PreviewOptions, type ServerOptions, type UserConfig } from "vite";
import { ViteConfig } from "./vite-config.js";
import { type VitePlugin } from "../plugins/vite-plugin.js";
import { RootEntryDevPlugin } from "../plugins/root-entry-dev-plugin.js";
import { type OutgoingHttpHeaders } from "node:http";
import Path from "node:path";

//#region Web config
export class WebConfig extends ViteConfig {
	#pages: Readonly<Record<string, string>>;
	#type: AppType;
	#rootEntries: readonly URI[];
	#pathEntries: readonly URI[];
	#headers: Readonly<OutgoingHttpHeaders>;

	constructor(pages: Readonly<Record<string, string>>, type: AppType, rootEntries: readonly URI[], pathEntries: readonly URI[], output: URI, plugins: readonly VitePlugin[], headers: Readonly<OutgoingHttpHeaders>) {
		const devPlugin = new RootEntryDevPlugin(WebConfig.#normalizeServiceWorkerDevEntries(rootEntries));
		super(output, [...plugins, devPlugin], "ES2025", "ES2025");
		if (new.target === WebConfig) throw new TypeError("Unable to create an instance of an abstract class");
		this.#pages = pages;
		this.#type = type;
		this.#rootEntries = rootEntries;
		this.#pathEntries = pathEntries;
		this.#headers = headers;
	}

	static get root(): string {
		return `${process.cwd().replace(/\\/g, "/")}/`;
	}

	#normalizeServiceWorkers(): Record<string, string> {
		const entries: Record<string, string> = {};
		for (const uri of this.#rootEntries) {
			const path = uri.toPath();
			const { name } = Path.parse(path);
			entries[name] = path;
		}
		return entries;
	}

	static #normalizeServiceWorkerDevEntries(rootEntries: readonly URI[]): Map<string, string> {
		const { root } = WebConfig;
		const entries = new Map<string, string>();
		for (const uri of rootEntries) {
			const path = uri.toPath().replace(/\\/g, "/");
			const { name } = Path.parse(path);
			const relative = path.replace(root, String.empty);
			entries.set(`/${name}.js`, `/${relative}`);
		}
		return entries;
	}

	#normalizeRelativeDirects(): Record<string, string> {
		const { root } = WebConfig;
		const entries: Record<string, string> = {};
		for (const uri of this.#pathEntries) {
			entries[ViteConfig.relative(uri, root)] = uri.toPath();
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
		const workers = this.#normalizeServiceWorkers();
		const directs = this.#normalizeRelativeDirects();
		const input: InputOption = { ...this.#pages, ...workers, ...directs };
		const names = new Set([...Object.keys(workers), ...Object.keys(directs)]);
		const output: OutputOptions = this.#buildOutput(names);
		return { input, output };
	}

	#buildServer(): ServerOptions {
		const strictPort: boolean = true;
		const headers: Readonly<OutgoingHttpHeaders> = this.#headers;
		const preTransformRequests: boolean = false;
		return { strictPort, headers, preTransformRequests };
	}

	#buildWorker(): NonNullable<UserConfig["worker"]> {
		const format = "es" as const;
		return { format };
	}

	#buildPreview(): PreviewOptions {
		const headers: Readonly<OutgoingHttpHeaders> = this.#headers;
		return { headers };
	}

	build(): UserConfig {
		const { esbuild, plugins } = super.build();
		const base: string = "./";
		const appType: AppType = this.#type;
		const publicDir: string = "resources";
		const build: BuildEnvironmentOptions = this.buildEnvironment(this.#buildRollupOptions());
		const client: EnvironmentOptions = { build };
		const environments: Record<string, EnvironmentOptions> = { client };
		const server: ServerOptions = this.#buildServer();
		const preview: PreviewOptions = this.#buildPreview();
		const worker = this.#buildWorker();
		return { base, appType, publicDir, environments, server, preview, esbuild, worker, plugins };
	}
}
//#endregion
