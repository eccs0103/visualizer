"use strict";

import "adaptive-extender/web";

//#region Wake guard
export class WakeGuard {
	#sentinel: WakeLockSentinel | null = null;
	#reasons: Set<string> = new Set();

	constructor() {
		document.addEventListener("visibilitychange", event => void this.#reconcile());
	}

	activate(reason: string): void {
		this.#reasons.add(reason);
		void this.#reconcile();
	}

	deactivate(reason: string): void {
		this.#reasons.delete(reason);
		void this.#reconcile();
	}

	async #reconcile(): Promise<void> {
		if (this.#reasons.size > 0 && !document.hidden) return await this.#acquire();
		await this.#release();
	}

	async #acquire(): Promise<void> {
		if (!("wakeLock" in navigator)) return;
		if (this.#sentinel !== null) return;
		try {
			const sentinel = await navigator.wakeLock.request("screen");
			sentinel.addEventListener("release", event => this.#sentinel = null);
			this.#sentinel = sentinel;
		} catch (reason) {
			console.error(`Failed to acquire screen wake lock cause:\n${Error.from(reason)}`);
		}
	}

	async #release(): Promise<void> {
		const sentinel = this.#sentinel;
		if (sentinel === null) return;
		this.#sentinel = null;
		try {
			await sentinel.release();
		} catch (reason) {
			console.error(`Failed to release screen wake lock cause:\n${Error.from(reason)}`);
		}
	}
}
//#endregion
