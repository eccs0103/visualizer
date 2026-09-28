"use strict";

import "adaptive-extender/core";
import { type Environment } from "adaptive-extender/core";
import { CloudflareWorker } from "./cloudflare-worker.js";
import { VisitorCookies } from "./visitor-cookies.js";

//#region Site worker
interface SiteServices {
	ASSETS: Fetcher;
}
type SiteBindings = Environment & SiteServices;

/** Serves the static site unchanged and only adds the visitor cookies to page responses. Tagging can never break the site: on any failure the untouched file is returned. */
class SiteWorker extends CloudflareWorker<SiteBindings> {
	async run(request: Request, environment: SiteBindings, context: ExecutionContext): Promise<Response> {
		void context;
		const response = await environment.ASSETS.fetch(request);
		if (!SiteWorker.#isPage(response)) return response;
		try {
			return SiteWorker.#tag(response, new VisitorCookies(request).issue());
		} catch (reason) {
			console.error(`Visitor cookies failed:\n${Error.from(reason)}`);
			return response;
		}
	}

	static #isPage(response: Response): boolean {
		const type = response.headers.get("Content-Type");
		if (type === null) return false;
		return type.startsWith("text/html");
	}

	static #tag(response: Response, lines: string[]): Response {
		const tagged = new Response(response.body, response);
		for (const line of lines) tagged.headers.append("Set-Cookie", line);
		return tagged;
	}
}

export default new SiteWorker();
//#endregion
