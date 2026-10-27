"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Page leave
export interface PageLeaveScheme {
	visible_ms: number;
	max_scroll_percent: number;
}

export class PageLeave extends Model {
	/** Deliberately not named engagement_time_msec: GA4 sums that parameter across events as incremental engagement, so a running total under that name would inflate GA4's own engagement metrics. */
	@Field(Number, { name: "visible_ms" })
	visibleMilliseconds: number;

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
