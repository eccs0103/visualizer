"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region Session context
export class SessionContext extends Model {
	/** Full URL that navigated to this page. "direct" when document.referrer is empty (typed URL, bookmark, or referrer policy stripped it). */
	@Field(String, "referrer_url")
	referrerUrl: string;

	/** Hostname of the referring page (e.g. "google.com", "t.me"). "direct" when there is no referrer. "unknown" if the referrer URL could not be parsed. */
	@Field(String, "referrer_domain")
	referrerDomain: string;

	/** PerformanceNavigationTiming.type — how the current document was reached: "navigate" (fresh load), "reload", "back_forward" (history traversal), or "prerender". Falls back to "navigate" when Navigation Timing API is unavailable. */
	@Field(String, "navigation_type")
	navigationType: string;

	/** Full navigator.languages list joined by comma (e.g. "en-US,ru,fr"). Ordered by priority; the first entry matches primary_language in user properties. */
	@Field(String, "all_languages")
	allLanguages: string;

	/** NetworkInformation.type — physical connection category: "wifi", "cellular", "ethernet", "bluetooth", "wimax", "other", "none", or "unknown". Available in Chromium only; absent in Firefox and Safari. */
	@Field(Optional(String), "connection_type")
	connectionType: string | undefined;

	/** NetworkInformation.effectiveType — estimated quality bracket: "4g", "3g", "2g", or "slow-2g". Derived from RTT and downlink measurements. Chromium only. */
	@Field(Optional(String), "effective_connection")
	effectiveConnection: string | undefined;

	/** NetworkInformation.downlink in Mbit/s, rounded to 25 kbit/s granularity and capped at 10 Mbit/s. Chromium only. */
	@Field(Optional(Number), "downlink_mbps")
	downlinkMbps: number | undefined;

	/** NetworkInformation.rtt — estimated round-trip time in milliseconds, rounded to the nearest 25 ms. Chromium only. */
	@Field(Optional(Number), "round_trip_time_ms")
	roundTripTimeMs: number | undefined;

	/** NetworkInformation.saveData — true when the user has enabled "Lite mode" or data-saving in browser / OS settings. Chromium only. */
	@Field(Optional(Boolean), "data_saver_enabled")
	dataSaverEnabled: boolean | undefined;

	/** utm_source query parameter from the landing URL. Present only when the user arrived via a tracked campaign link. */
	@Field(Optional(String), "utm_source")
	utmSource: string | undefined;

	/** utm_medium query parameter from the landing URL (e.g. "email", "social", "cpc"). */
	@Field(Optional(String), "utm_medium")
	utmMedium: string | undefined;

	/** utm_campaign query parameter from the landing URL. */
	@Field(Optional(String), "utm_campaign")
	utmCampaign: string | undefined;

	constructor();
	constructor(referrerUrl: string, referrerDomain: string, navigationType: string, allLanguages: string, connectionType: string | undefined, effectiveConnection: string | undefined, downlinkMbps: number | undefined, roundTripTimeMs: number | undefined, dataSaverEnabled: boolean | undefined, utmSource: string | undefined, utmMedium: string | undefined, utmCampaign: string | undefined);
	constructor(referrerUrl?: string, referrerDomain?: string, navigationType?: string, allLanguages?: string, connectionType?: string, effectiveConnection?: string, downlinkMbps?: number, roundTripTimeMs?: number, dataSaverEnabled?: boolean, utmSource?: string, utmMedium?: string, utmCampaign?: string) {
		if (referrerUrl === undefined || referrerDomain === undefined || navigationType === undefined || allLanguages === undefined) {
			super();
			return;
		}

		super();
		this.referrerUrl = referrerUrl;
		this.referrerDomain = referrerDomain;
		this.navigationType = navigationType;
		this.allLanguages = allLanguages;
		this.connectionType = connectionType;
		this.effectiveConnection = effectiveConnection;
		this.downlinkMbps = downlinkMbps;
		this.roundTripTimeMs = roundTripTimeMs;
		this.dataSaverEnabled = dataSaverEnabled;
		this.utmSource = utmSource;
		this.utmMedium = utmMedium;
		this.utmCampaign = utmCampaign;
	}
}
//#endregion
