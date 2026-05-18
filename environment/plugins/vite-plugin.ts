"use strict";

import "adaptive-extender/node";
import { type Promisable } from "adaptive-extender/node";
import { type PluginOption, type ViteDevServer, type PreviewServer } from "vite";

//#region Vite plugin
export class VitePlugin {
	#name: string;

	constructor(name: string) {
		if (new.target === VitePlugin) throw new TypeError("Unable to create an instance of an abstract class");
		this.#name = name;
	}

	writeBundle(): Promisable<void> {
	}

	configureServer(server: ViteDevServer): Promisable<void> {
		void server;
	}

	configurePreviewServer(server: PreviewServer): Promisable<void> {
		void server;
	}

	build(): PluginOption {
		const name: string = this.#name;
		const writeBundle = this.writeBundle.bind(this);
		const configureServer = this.configureServer.bind(this);
		const configurePreviewServer = this.configurePreviewServer.bind(this);
		return { name, writeBundle, configureServer, configurePreviewServer };
	}
}
//#endregion
