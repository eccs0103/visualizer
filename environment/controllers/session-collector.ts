"use strict";

import "adaptive-extender/web";

export class SessionCollector {
	static #userKey = "_uaf";
	static #sessionKey = "_saf";

	userFingerprint: string;
	sessionFingerprint: string;

	constructor() {
		this.userFingerprint = SessionCollector.#loadKey(localStorage, SessionCollector.#userKey);
		this.sessionFingerprint = SessionCollector.#loadKey(sessionStorage, SessionCollector.#sessionKey);
	}

	static #loadKey(storage: Storage, key: string): string {
		const existing = storage.getItem(key);
		if (existing !== null) return existing;
		const fresh = crypto.randomUUID();
		storage.setItem(key, fresh);
		return fresh;
	}
}
