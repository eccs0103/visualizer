"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Session identity
export interface SessionIdentityScheme {
	user_id: string;
	session_fingerprint: string;
}

export class SessionIdentity extends Model {
	@Field(String, { name: "user_id" })
	userId: string;

	@Field(String, { name: "session_fingerprint" })
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
