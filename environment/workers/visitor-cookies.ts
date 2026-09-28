"use strict";

import "adaptive-extender/core";

//#region Visitor cookies
export class VisitorCookies {
	static #site: string = "eccs.dev";
	static #keyUser: string = "_uaf";
	static #keyNetwork: string = "_net";
	static #lifetime: number = 63072000;
	static #networkLifetime: number = 1800;
	static #pattern: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

	#user: string;
	#network: string | null;
	#scope: string[];

	constructor(request: Request) {
		this.#user = VisitorCookies.#identify(request);
		this.#network = VisitorCookies.#organization(request);
		this.#scope = VisitorCookies.#attributes(request);
	}

	static #read(request: Request, name: string): string | null {
		const header = request.headers.get("Cookie");
		if (header === null) return null;
		const prefix = `${name}=`;
		const entry = header.split(";").map(pair => pair.trim()).find(pair => pair.startsWith(prefix));
		if (entry === undefined) return null;
		return entry.slice(prefix.length);
	}

	/** Keeps a well-formed existing id and re-issues it server-side, so Safari's 7-day cap on script-written cookies never applies; anything else is replaced by a fresh random id. */
	static #identify(request: Request): string {
		const existing = VisitorCookies.#read(request, VisitorCookies.#keyUser);
		if (existing === null) return crypto.randomUUID();
		if (!VisitorCookies.#pattern.test(existing)) return crypto.randomUUID();
		return existing;
	}

	static #organization(request: Request): string | null {
		const { cf } = request;
		if (cf === undefined) return null;
		const { asOrganization } = cf;
		if (typeof asOrganization !== "string") return null;
		return asOrganization;
	}

	static #attributes(request: Request): string[] {
		const scope = ["Path=/", "SameSite=Lax", "Secure"];
		const site = VisitorCookies.#site;
		const { hostname } = new URL(request.url);
		if (hostname === site || hostname.endsWith(`.${site}`)) scope.push(`Domain=${site}`);
		return scope;
	}

	#line(name: string, value: string, lifetime: number): string {
		return [`${name}=${encodeURIComponent(value)}`, `Max-Age=${lifetime}`, ...this.#scope].join("; ");
	}

	issue(): string[] {
		const lines = [this.#line(VisitorCookies.#keyUser, this.#user, VisitorCookies.#lifetime)];
		const network = this.#network;
		if (network === null) return lines;
		lines.push(this.#line(VisitorCookies.#keyNetwork, network, VisitorCookies.#networkLifetime));
		return lines;
	}
}
//#endregion
