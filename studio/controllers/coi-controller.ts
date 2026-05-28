"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";

const { baseURI } = document;

//#region CORS isolation controller
export class CorsIsolationController extends Controller {
	async run(): Promise<void> {
		if (crossOriginIsolated) return;
		const registration = await navigator.serviceWorker.register(new URL("../coi-worker.js", baseURI), { type: "module" });
		await Promise.withSignal((signal, resolve) => {
			registration.addEventListener("updatefound", event => resolve(), { signal });
			if (registration.active !== null) resolve();
		});
		location.reload();
	}

	async catch(error: Error): Promise<void> {
		throw error;
	}
}
//#endregion
