"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { PerformanceContext } from "../models/performance-context.js";
import { AnalyticsService } from "../services/analytics-service.js";

const { round } = Math;
const analytics = AnalyticsService.instance;

//#region Web vitals collector
declare global {
	export interface LayoutShiftEntry extends PerformanceEntry {
		value: number;
		hadRecentInput: boolean;
	}

	export interface PerformanceObserverInit {
		durationThreshold?: number;
	}
}

export class WebVitalsCollector extends Controller {
	#fcp: number | undefined = undefined;
	#lcp: number | undefined = undefined;
	#ttfb: number | undefined = undefined;
	#clsTotal: number = 0;
	#inpWorst: number = 0;
	#longTasks: number = 0;
	#abort: AbortController = new AbortController();

	async run(): Promise<void> {
		const [navigation] = performance.getEntriesByType("navigation");
		if (navigation instanceof PerformanceNavigationTiming) {
			const ttfb = round(navigation.responseStart);
			if (ttfb > 0) this.#ttfb = ttfb;
		}

		this.#observeFcp();
		this.#observeLcp();
		this.#observeCls();
		this.#observeInp();
		this.#observeLongTasks();

		const { signal } = this.#abort;
		document.addEventListener("visibilitychange", this.#onHidden.bind(this), { signal });
	}

	static #measure(value: number, scale: number): number | undefined {
		if (value > 0) return round(value * scale);
		return undefined;
	}

	#onHidden(event: Event): void {
		if (document.visibilityState !== "hidden") return;
		const fcp = this.#fcp;
		const lcp = this.#lcp;
		const ttfb = this.#ttfb;
		const cls = WebVitalsCollector.#measure(this.#clsTotal, 1000);
		const inp = WebVitalsCollector.#measure(this.#inpWorst, 1);
		const longTasks = WebVitalsCollector.#measure(this.#longTasks, 1);
		analytics.dispatch("performance_context", new PerformanceContext(fcp, lcp, ttfb, cls, inp, longTasks));
		this.#abort.abort();
	}

	#isLayoutShift(entry: PerformanceEntry): entry is LayoutShiftEntry {
		return "value" in entry && "hadRecentInput" in entry;
	}

	#observeFcp(): void {
		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (entry.name !== "first-contentful-paint") continue;
				this.#fcp = round(entry.startTime);
			}
			observer.disconnect();
		});
		observer.observe({ type: "paint", buffered: true });
	}

	#observeLcp(): void {
		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (!(entry instanceof LargestContentfulPaint)) continue;
				this.#lcp = round(entry.renderTime || entry.loadTime);
			}
		});
		observer.observe({ type: "largest-contentful-paint", buffered: true });
	}

	#observeCls(): void {
		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (!this.#isLayoutShift(entry)) continue;
				if (entry.hadRecentInput) continue;
				this.#clsTotal += entry.value;
			}
		});
		observer.observe({ type: "layout-shift", buffered: true });
	}

	#observeInp(): void {
		try {
			const observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (!(entry instanceof PerformanceEventTiming)) continue;
					const duration = round(entry.duration);
					if (duration > this.#inpWorst) this.#inpWorst = duration;
				}
			});
			observer.observe({ type: "event", buffered: true, durationThreshold: 40 });
		} catch { /* INP not supported in this browser */ }
	}

	#observeLongTasks(): void {
		try {
			const observer = new PerformanceObserver((list) => {
				this.#longTasks += list.getEntries().length;
			});
			observer.observe({ type: "longtask", buffered: true });
		} catch { /* longtask not supported in this browser */ }
	}

	async catch(error: Error): Promise<void> {
		console.error(`Web vitals collection failed:\n${error}`);
	}
}
//#endregion
