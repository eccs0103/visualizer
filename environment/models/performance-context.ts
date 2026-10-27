"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region Performance context
export interface PerformanceContextScheme {
	fcp_ms: number | undefined;
	lcp_ms: number | undefined;
	ttfb_ms: number | undefined;
	cls_score: number | undefined;
	inp_ms: number | undefined;
	long_tasks: number | undefined;
}

export class PerformanceContext extends Model {
	@Field(Optional.Of(Number), { name: "fcp_ms" })
	fcpMs: number | undefined;

	@Field(Optional.Of(Number), { name: "lcp_ms" })
	lcpMs: number | undefined;

	@Field(Optional.Of(Number), { name: "ttfb_ms" })
	ttfbMs: number | undefined;

	/** Multiplied by 1000 and rounded, because GA4 parameters are integers (CLS 0.153 → 153). */
	@Field(Optional.Of(Number), { name: "cls_score" })
	clsScore: number | undefined;

	@Field(Optional.Of(Number), { name: "inp_ms" })
	inpMs: number | undefined;

	@Field(Optional.Of(Number), { name: "long_tasks" })
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
