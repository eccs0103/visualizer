"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Page leave
export class PageLeave extends Model {
	/** Accumulated foreground-visible time for this page in milliseconds. Deliberately not named engagement_time_msec: GA4 sums that parameter across events as incremental engagement, so a running total under that name would inflate GA4's own engagement metrics. */
	@Field(Number, { name: "visible_ms" })
	visibleMilliseconds: number;

	/** Maximum scroll depth reached during the entire visit as an integer percentage (0–100). Monotonically non-decreasing — scrolling back up does not lower this value. */
	@Field(Number, { name: "max_scroll_percent" })
	maxScrollPercent: number;

	constructor();
	constructor(visibleMilliseconds: number, maxScrollPercent: number);
	constructor(visibleMilliseconds?: number, maxScrollPercent?: number) {
		if (visibleMilliseconds === undefined || maxScrollPercent === undefined) {
			super();
			return;
		}

		super();
		this.visibleMilliseconds = visibleMilliseconds;
		this.maxScrollPercent = maxScrollPercent;
	}
}
//#endregion
