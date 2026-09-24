"use strict";

import "adaptive-extender/web";
import { PageLeave } from "../models/page-leave.js";
import { AnalyticsService } from "../services/analytics-service.js";
import { Controller } from "adaptive-extender/web";

const { round, min } = Math;
const analytics = AnalyticsService.instance;

//#region Engagement collector
export class EngagementCollector extends Controller {
	#maxScrollPercent = 0;
	#totalVisibleMilliseconds = 0;
	#sinceVisible: number | null = null;

	async run(): Promise<void> {
		if (document.visibilityState === "visible") this.#sinceVisible = Date.now();
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
			this.#sinceVisible = Date.now();
			return;
		}
		const sinceVisible = this.#sinceVisible;
		if (sinceVisible !== null) {
			this.#totalVisibleMilliseconds += Date.now() - sinceVisible;
			this.#sinceVisible = null;
		}
		const engagement = this.#totalVisibleMilliseconds;
		const timeOnPage = round(engagement / 1000);
		const maxScrollPercent = this.#maxScrollPercent;
		analytics.dispatch("page_leave", new PageLeave(engagement, timeOnPage, maxScrollPercent));
	}

	async catch(error: Error): Promise<void> {
		console.error(`Engagement collection failed:\n${error}`);
	}
}
//#endregion
