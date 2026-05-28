"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";

const { baseURI } = document;

//#region CORS isolation controller
class CorsIsolationController extends Controller {
	async run(): Promise<void> {
		if (crossOriginIsolated) return;
		const registration = await navigator.serviceWorker.register(new URL("../coi-service.js", baseURI));
		registration.addEventListener("updatefound", event => location.reload());
		if (registration.active !== null) location.reload();
	}

	async catch(error: Error): Promise<void> {
		throw error;
	}
}
//#endregion

await CorsIsolationController.launch();
