"use strict";

import "adaptive-extender/web";

//#region Cookie jar
export class CookieJar {
	static #site: string = "eccs.dev";
	static #lifetime: number = 63072000;

	static read(name: string): string | null {
		const prefix = `${name}=`;
		const entry = document.cookie.split("; ").find(pair => pair.startsWith(prefix));
		if (entry === undefined) return null;
		return decodeURIComponent(entry.slice(prefix.length));
	}

	static write(name: string, value: string): void {
		const attributes = [`${name}=${encodeURIComponent(value)}`, "Path=/", `Max-Age=${CookieJar.#lifetime}`, "SameSite=Lax", "Secure"];
		const site = CookieJar.#site;
		const { hostname } = location;
		if (hostname === site || hostname.endsWith(`.${site}`)) attributes.push(`Domain=${site}`);
		document.cookie = attributes.join("; ");
	}
}
//#endregion
