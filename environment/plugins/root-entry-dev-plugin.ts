"use strict";

import "adaptive-extender/node";
import { type Connect, type ViteDevServer } from "vite";
import { type ServerResponse } from "node:http";
import { VitePlugin } from "./vite-plugin.js";

//#region Root entry dev plugin
/** Serves root-level entries (e.g. a service worker) transformed on the fly during `vite dev`, mirroring the `[name].js` filenames `ViteConfig` gives them at build time. */
export class RootEntryDevPlugin extends VitePlugin {
	#entries: ReadonlyMap<string, string>;

	constructor(entries: ReadonlyMap<string, string>) {
		super("root-entry-dev");
		this.#entries = entries;
	}

	async #respond(server: ViteDevServer, path: string, response: ServerResponse, next: Connect.NextFunction): Promise<void> {
		try {
			const result = await server.transformRequest(path);
			if (result === null) return next();
			response.setHeader("Content-Type", "text/javascript");
			response.end(result.code);
		} catch (reason) {
			next(reason);
		}
	}

	configureServer(server: ViteDevServer): void {
		const entries = this.#entries;
		server.middlewares.use((request, response, next) => {
			const url = request.url;
			if (url === undefined) return next();
			const path = entries.get(url.split("?")[0]);
			if (path === undefined) return next();
			void this.#respond(server, path, response, next);
		});
	}
}
//#endregion
