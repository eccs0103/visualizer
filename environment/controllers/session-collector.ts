"use strict";

import "adaptive-extender/web";
import { CookieJar } from "../services/cookie-jar.js";

//#region Session collector
export class SessionCollector {
	static #keyUser = "_uaf";
	static #keySession = "_saf";

	userFingerprint: string;
	sessionFingerprint: string;

	constructor() {
		this.userFingerprint = SessionCollector.#loadUser();
		this.sessionFingerprint = SessionCollector.#loadKey(sessionStorage, SessionCollector.#keySession);
	}

	static #loadKey(storage: Storage, key: string): string {
		const existing = storage.getItem(key);
		if (existing !== null) return existing;
		const fresh = crypto.randomUUID();
		storage.setItem(key, fresh);
		return fresh;
	}

	/** The visitor id lives in a cookie on the whole eccs.dev domain, so every subdomain shares it; the site worker refreshes it server-side. An id still in this origin's localStorage (the old storage) is adopted once, so existing visitors keep theirs. */
	static #loadUser(): string {
		const key = SessionCollector.#keyUser;
		const legacy = localStorage.getItem(key);
		if (legacy !== null) return SessionCollector.#adopt(key, legacy);
		const existing = CookieJar.read(key);
		if (existing !== null) return existing;
		return SessionCollector.#adopt(key, crypto.randomUUID());
	}

	/** Stores the id in the cookie. If the browser refuses the cookie, the id stays in localStorage instead, so it is still stable on this origin. */
	static #adopt(key: string, id: string): string {
		CookieJar.write(key, id);
		if (CookieJar.read(key) !== id) {
			localStorage.setItem(key, id);
			return id;
		}
		localStorage.removeItem(key);
		return id;
	}
}
//#endregion
