"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region Session context
export class SessionContext extends Model {
	/** Hostname of the referring page (e.g. "google.com", "t.me"). "direct" when there is no referrer. "unknown" if the referrer URL could not be parsed. The full referrer URL is not sent: GA4 already records it as page_referrer. */
	@Field(String, { name: "referrer_domain" })
	domainReferrer: string;

	/** PerformanceNavigationTiming.type — how the current document was reached: "navigate" (fresh load), "reload", "back_forward" (history traversal), or "prerender". Falls back to "navigate" when Navigation Timing API is unavailable. */
	@Field(String, { name: "navigation_type" })
	typeNavigation: string;

	/** Full navigator.languages list joined by comma (e.g. "en-US,ru,fr"). Ordered by priority. GA4 itself only records the first entry (device.language). */
	@Field(String, { name: "all_languages" })
	languages: string;

	/** NetworkInformation.type — physical connection category: "wifi", "cellular", "ethernet", "bluetooth", "wimax", "other", "none", or "unknown". Available in Chromium only; absent in Firefox and Safari. */
	@Field(Optional.Of(String), { name: "connection_type" })
	typeConnection: string | undefined;

	/** NetworkInformation.effectiveType — estimated quality bracket: "4g", "3g", "2g", or "slow-2g". Derived from RTT and downlink measurements. Chromium only. */
	@Field(Optional.Of(String), { name: "effective_connection" })
	effectiveConnection: string | undefined;

	/** NetworkInformation.downlink in Mbit/s, rounded to 25 kbit/s granularity and capped at 10 Mbit/s. Chromium only. */
	@Field(Optional.Of(Number), { name: "downlink_mbps" })
	downlink: number | undefined;

	/** NetworkInformation.rtt — estimated round-trip time in milliseconds, rounded to the nearest 25 ms. Chromium only. */
	@Field(Optional.Of(Number), { name: "round_trip_time_ms" })
	roundTripTimeMs: number | undefined;

	/** NetworkInformation.saveData — true when the user has enabled "Lite mode" or data-saving in browser / OS settings. Chromium only. */
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
