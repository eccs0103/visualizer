"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";

const { baseURI } = document;

//#region CORS isolation controller
export class CorsIsolationController extends Controller {
	static #MAX_32_BIT_INTEGER: number = 2_147_483_647;

	async run(): Promise<void> {
		if (crossOriginIsolated) return;
		const { serviceWorker } = navigator;
		const url = new URL("../coi-worker.js", baseURI);
		await serviceWorker.register(url, { type: "module" });
		await Promise.withSignal((signal, resolve) => {
			serviceWorker.addEventListener("controllerchange", event => resolve(), { signal });
			if (serviceWorker.controller !== null) resolve();
		});
		location.reload();
		await Promise.asTimeout(CorsIsolationController.#MAX_32_BIT_INTEGER);
	}

	async catch(error: Error): Promise<void> {
		throw error;
	}
}
//#endregion
