"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";

declare const self: ServiceWorkerGlobalScope;

//#region COI service worker
class CrossOriginIsolationWorker extends Controller {
	async #tryFetch(request: Request): Promise<Response> {
		try {
			return await fetch(request);
		} catch {
			return Response.error();
		}
	}

	async #buildIsolatedResponse(request: Request): Promise<Response> {
		const response = await this.#tryFetch(request);
		if (response.status === 0) return response;
		const { body, status, statusText } = response;
		const headers = new Headers(response.headers);
		headers.set("Cross-Origin-Opener-Policy", "same-origin");
		headers.set("Cross-Origin-Embedder-Policy", "require-corp");
		return new Response(body, { status, statusText, headers });
	}

	async run(): Promise<void> {
		self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
		self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
		self.addEventListener("fetch", event => event.respondWith(this.#buildIsolatedResponse(event.request)));
	}
}
//#endregion

void CrossOriginIsolationWorker.launch();
