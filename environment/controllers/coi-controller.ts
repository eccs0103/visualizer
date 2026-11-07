"use strict";

import "adaptive-extender/web";
import { Controller, URI } from "adaptive-extender/web";

const { baseURI } = document;

//#region Cross-origin isolation controller
export class CrossOriginIsolationController extends Controller {
	static #maxDelay: number = 2_147_483_647;

	async run(): Promise<void> {
		if (crossOriginIsolated) return;
		const { serviceWorker } = navigator;
		const uri = new URI("../coi-worker.js", baseURI);
		await serviceWorker.register(uri.href, { type: "module" });
		await serviceWorker.ready;
		location.reload();
		await Promise.asTimeout(CrossOriginIsolationController.#maxDelay);
	}
}
//#endregion
