"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region Performance context
export class PerformanceContext extends Model {
	/** First Contentful Paint — milliseconds from navigation start until the browser renders the first text or image. Collected via PerformanceObserver (paint). Available in all modern browsers. */
	@Field(Optional(Number), "fcp_ms")
	fcpMs: number | undefined;

	/** Largest Contentful Paint — milliseconds until the largest visible image or text block is rendered. Final value captured at page hide. Available in all modern browsers. */
	@Field(Optional(Number), "lcp_ms")
	lcpMs: number | undefined;

	/** Time to First Byte — milliseconds from navigation start until the first byte of the document response is received. Collected from PerformanceNavigationTiming.responseStart. Available in all modern browsers. */
	@Field(Optional(Number), "ttfb_ms")
	ttfbMs: number | undefined;

	/** Cumulative Layout Shift score multiplied by 1000 and rounded to an integer (e.g. CLS of 0.153 → 153) to preserve precision in GA4's integer parameter fields. Accumulated until page hide. Available in all modern browsers. */
	@Field(Optional(Number), "cls_score")
	clsScore: number | undefined;

	/** Interaction to Next Paint — worst-case interaction latency in milliseconds observed during the session. Collected via PerformanceObserver (event, threshold 40 ms). Chromium only; absent in Firefox and Safari. */
	@Field(Optional(Number), "inp_ms")
	inpMs: number | undefined;

	/** Count of long tasks — main-thread tasks that blocked the browser for more than 50 ms. Collected via PerformanceObserver (longtask). Chromium only. */
	@Field(Optional(Number), "long_tasks")
	longTasks: number | undefined;

	constructor();
	constructor(fcpMs: number | undefined, lcpMs: number | undefined, ttfbMs: number | undefined, clsScore: number | undefined, inpMs: number | undefined, longTasks: number | undefined);
	constructor(fcpMs?: number, lcpMs?: number, ttfbMs?: number, clsScore?: number, inpMs?: number, longTasks?: number) {
		super();
		this.fcpMs = fcpMs;
		this.lcpMs = lcpMs;
		this.ttfbMs = ttfbMs;
		this.clsScore = clsScore;
		this.inpMs = inpMs;
		this.longTasks = longTasks;
	}
}
//#endregion
