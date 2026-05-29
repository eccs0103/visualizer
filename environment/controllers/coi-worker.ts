"use strict";

import "adaptive-extender/worker";

interface COIScope {
	readonly clients: { claim(): Promise<void>; };
	skipWaiting(): Promise<void>;
	addEventListener(type: "install" | "activate", listener: (event: { waitUntil(f: PromiseLike<unknown>): void; }) => void): void;
	addEventListener(type: "fetch", listener: (event: { request: Request; respondWith(r: PromiseLike<Response> | Response): void; }) => void): void;
}

async function buildIsolatedResponse(request: Request): Promise<Response> {
	let response: Response;
	try {
		response = await fetch(request);
	} catch {
		return Response.error();
	}
	if (response.status === 0) return response;
	const { body, status, statusText } = response;
	const headers = new Headers(response.headers);
	headers.set("Cross-Origin-Opener-Policy", "same-origin");
	headers.set("Cross-Origin-Embedder-Policy", "require-corp");
	return new Response(body, { status, statusText, headers });
}

const scope: COIScope = self as unknown as COIScope;
scope.addEventListener("install", event => event.waitUntil(scope.skipWaiting()));
scope.addEventListener("activate", event => event.waitUntil(scope.clients.claim()));
scope.addEventListener("fetch", event => event.respondWith(buildIsolatedResponse(event.request)));
//#endregion
