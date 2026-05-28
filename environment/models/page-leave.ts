"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Page leave
export class PageLeave extends Model {
	/** GA4 native engagement time in milliseconds. Accumulated foreground-visible time for this page. GA4 uses this field to mark sessions as engaged (≥ 10 000 ms) and to populate "Average engagement time" in standard reports. */
	@Field(Number, "engagement_time_msec")
	engagementTimeMsec: number;

	/** Total seconds the tab was in the foreground (visible state). Human-readable counterpart of engagement_time_msec for GA4 Explorer filters and BigQuery queries. Rounded to the nearest whole second. */
	@Field(Number, "time_on_page")
	timeOnPage: number;

	/** Maximum scroll depth reached during the entire visit as an integer percentage (0–100). Monotonically non-decreasing — scrolling back up does not lower this value. */
	@Field(Number, "max_scroll_percent")
	maxScrollPercent: number;

	constructor();
	constructor(engagementTimeMsec: number, timeOnPage: number, maxScrollPercent: number);
	constructor(engagementTimeMsec?: number, timeOnPage?: number, maxScrollPercent?: number) {
		if (engagementTimeMsec === undefined || timeOnPage === undefined || maxScrollPercent === undefined) {
			super();
			return;
		}

		super();
		this.engagementTimeMsec = engagementTimeMsec;
		this.timeOnPage = timeOnPage;
		this.maxScrollPercent = maxScrollPercent;
	}
}
//#endregion
