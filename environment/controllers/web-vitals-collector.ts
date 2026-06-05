"use strict";

import "adaptive-extender/web";
import { PerformanceContext } from "../models/performance-context.js";
import { analytics } from "../services/analytics-service.js";
import { Controller } from "adaptive-extender/web";

const { round } = Math;

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
	#fcpMs?: number;
	#lcpMs?: number;
	#ttfbMs?: number;
	#clsTotal = 0;
	#inpWorstMs = 0;
	#longTaskCount = 0;

	async run(): Promise<void> {
		const [navEntry] = performance.getEntriesByType("navigation");
		if (navEntry instanceof PerformanceNavigationTiming) {
			const ttfb = round(navEntry.responseStart);
			if (ttfb > 0) this.#ttfbMs = ttfb;
		}

		this.#observeFcp();
		this.#observeLcp();
		this.#observeCls();
		this.#observeInp();
		this.#observeLongTasks();

		document.addEventListener("visibilitychange", (event) => {
			if (document.visibilityState !== "hidden") return;
			const fcpMs = this.#fcpMs;
			const lcpMs = this.#lcpMs;
			const ttfbMs = this.#ttfbMs;
			const clsScore = this.#clsTotal > 0 ? round(this.#clsTotal * 1000) : undefined;
			const inpMs = this.#inpWorstMs > 0 ? this.#inpWorstMs : undefined;
			const longTasks = this.#longTaskCount > 0 ? this.#longTaskCount : undefined;
			analytics.dispatch("performance_context", new PerformanceContext(fcpMs, lcpMs, ttfbMs, clsScore, inpMs, longTasks));
		}, { once: true });
	}

	#isLayoutShift(entry: PerformanceEntry): entry is LayoutShiftEntry {
		return "value" in entry && "hadRecentInput" in entry;
	}

	#observeFcp(): void {
		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (entry.name !== "first-contentful-paint") continue;
				this.#fcpMs = round(entry.startTime);
			}
			observer.disconnect();
		});
		observer.observe({ type: "paint", buffered: true });
	}

	#observeLcp(): void {
		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (!(entry instanceof LargestContentfulPaint)) continue;
				this.#lcpMs = round(entry.renderTime || entry.loadTime);
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
					if (duration > this.#inpWorstMs) this.#inpWorstMs = duration;
				}
			});
			observer.observe({ type: "event", buffered: true, durationThreshold: 40 });
		} catch { /* INP not supported in this browser */ }
	}

	#observeLongTasks(): void {
		try {
			const observer = new PerformanceObserver((list) => {
				this.#longTaskCount += list.getEntries().length;
			});
			observer.observe({ type: "longtask", buffered: true });
		} catch { /* longtask not supported in this browser */ }
	}

	async catch(error: Error): Promise<void> {
		console.error(`Web vitals collection failed:\n${error}`);
	}
}
//#endregion
