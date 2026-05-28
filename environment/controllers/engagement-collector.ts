"use strict";

import "adaptive-extender/web";
import { PageLeave } from "../models/page-leave.js";
import { analytics } from "../services/analytics-service.js";
import { Controller } from "adaptive-extender/web";

const { round, min } = Math;

//#region Engagement collector
export class EngagementCollector extends Controller {
	#maxScrollPercent = 0;
	#totalVisibleMilliseconds = 0;
	#visibleSince: number | null = null;

	async run(): Promise<void> {
		if (document.visibilityState === "visible") this.#visibleSince = Date.now();
		window.addEventListener("scroll", this.#onScroll.bind(this), { passive: true });
		document.addEventListener("visibilitychange", this.#onVisibility.bind(this));
	}

	#onScroll(): void {
		const { scrollY, innerHeight } = window;
		const { scrollHeight } = document.documentElement;
		if (scrollHeight <= innerHeight) return;
		const scrollPercent = min(round((scrollY + innerHeight) / scrollHeight * 100), 100);
		if (scrollPercent > this.#maxScrollPercent) this.#maxScrollPercent = scrollPercent;
	}

	#onVisibility(): void {
		if (document.visibilityState !== "hidden") {
			this.#visibleSince = Date.now();
			return;
		}
		if (this.#visibleSince !== null) {
			this.#totalVisibleMilliseconds += Date.now() - this.#visibleSince;
			this.#visibleSince = null;
		}
		const engagementTimeMsec = this.#totalVisibleMilliseconds;
		const timeOnPage = round(engagementTimeMsec / 1000);
		const maxScrollPercent = this.#maxScrollPercent;
		analytics.dispatch("page_leave", new PageLeave(engagementTimeMsec, timeOnPage, maxScrollPercent));
	}

	async catch(error: Error): Promise<void> {
		console.error(`Engagement collection failed:\n${error}`);
	}
}
//#endregion
