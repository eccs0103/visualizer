"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region Session context
export interface SessionContextScheme {
	referrer_domain: string;
	navigation_type: string;
	all_languages: string;
	connection_type: string | undefined;
	effective_connection: string | undefined;
	downlink_mbps: number | undefined;
	round_trip_time_ms: number | undefined;
	data_saver_enabled: boolean | undefined;
}

export class SessionContext extends Model {
	@Field(String, { name: "referrer_domain" })
	domainReferrer: string;

	@Field(String, { name: "navigation_type" })
	typeNavigation: string;

	@Field(String, { name: "all_languages" })
	languages: string;

	@Field(Optional.Of(String), { name: "connection_type" })
	typeConnection: string | undefined;

	@Field(Optional.Of(String), { name: "effective_connection" })
	effectiveConnection: string | undefined;

	@Field(Optional.Of(Number), { name: "downlink_mbps" })
	downlink: number | undefined;

	@Field(Optional.Of(Number), { name: "round_trip_time_ms" })
	roundTripTimeMs: number | undefined;

	@Field(Optional.Of(Boolean), { name: "data_saver_enabled" })
	dataSaver: boolean | undefined;

	constructor();
	constructor(domainReferrer: string, typeNavigation: string, languages: string, typeConnection: string | undefined, effectiveConnection: string | undefined, downlink: number | undefined, roundTripTimeMs: number | undefined, dataSaver: boolean | undefined);
	constructor(domainReferrer?: string, typeNavigation?: string, languages?: string, typeConnection?: string, effectiveConnection?: string, downlink?: number, roundTripTimeMs?: number, dataSaver?: boolean) {
		if (domainReferrer === undefined || typeNavigation === undefined || languages === undefined) {
			super();
			return;
		}

		super();
		this.domainReferrer = domainReferrer;
		this.typeNavigation = typeNavigation;
		this.languages = languages;
		this.typeConnection = typeConnection;
		this.effectiveConnection = effectiveConnection;
		this.downlink = downlink;
		this.roundTripTimeMs = roundTripTimeMs;
		this.dataSaver = dataSaver;
	}
}
//#endregion
