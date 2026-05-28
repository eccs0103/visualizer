"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Session identity
export class SessionIdentity extends Model {
	/** GA4 native User-ID. Persisted UUID for this browser (localStorage). Stable across page loads and browser restarts; resets only if the user clears storage. Enables User-ID reporting in GA4 and links all sessions from the same browser. */
	@Field(String, "user_id")
	userId: string;

	/** Per-tab UUID (sessionStorage). Created fresh when the tab opens and discarded when the tab closes. Groups all events from a single visit together. */
	@Field(String, "session_fingerprint")
	sessionFingerprint: string;

	constructor();
	constructor(userId: string, sessionFingerprint: string);
	constructor(userId?: string, sessionFingerprint?: string) {
		if (userId === undefined || sessionFingerprint === undefined) {
			super();
			return;
		}

		super();
		this.userId = userId;
		this.sessionFingerprint = sessionFingerprint;
	}
}
//#endregion
