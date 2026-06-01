"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";

//#region COI service worker
class CorsIsolationWorker extends Controller {
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
		const scope = self as unknown as ServiceWorkerGlobalScope;
		scope.addEventListener("install", event => event.waitUntil(scope.skipWaiting()));
		scope.addEventListener("activate", event => event.waitUntil(scope.clients.claim()));
		scope.addEventListener("fetch", event => event.respondWith(this.#buildIsolatedResponse(event.request)));
	}

	async catch(error: Error): Promise<void> {
		throw error;
	}
}
//#endregion

await CorsIsolationWorker.launch();
