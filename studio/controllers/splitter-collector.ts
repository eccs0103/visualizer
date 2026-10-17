"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { type Visualizer } from "../services/visualizer.js";
import { type Smoothness, type FrameRate } from "../services/smoothness.js";
import { type ClipRecorder } from "../services/clip-recorder.js";
import { ActiveStatus, UnavailableStatus } from "../models/splitter-status.js";
import { SplitterReport } from "../models/splitter-report.js";
import { AnalyticsService } from "../../environment/services/analytics-service.js";

const analytics = AnalyticsService.instance;

//#region Splitter collector
export class SplitterCollector extends Controller<[Visualizer, Smoothness, ClipRecorder]> {
	static #after: number = 10;

	#visualizer: Visualizer;
	#smoothness: Smoothness;
	#recorder: ClipRecorder;
	#counts: Map<string, number> = new Map();
	#sent: Set<string> = new Set();

	#send(key: string, report: SplitterReport): void {
		const sent = this.#sent;
		if (sent.has(key)) return;
		sent.add(key);
		analytics.dispatch("splitter_report", report);
	}

	#onMeasure(frames: FrameRate): void {
		const { model, status } = this.#visualizer.splitter;
		const software = this.#smoothness.software;
		const recording = this.#recorder.isRecording;
		if (status instanceof UnavailableStatus) {
			const { reason } = status;
			return this.#send(reason, new SplitterReport(model?.folder ?? null, null, null, null, false, reason, frames.fps, software, recording));
		}
		if (!(status instanceof ActiveStatus) || model === null) return;
		const { folder } = model;
		const counts = this.#counts;
		const count = (counts.get(folder) ?? 0) + 1;
		counts.set(folder, count);
		if (count < SplitterCollector.#after) return;
		this.#send(folder, new SplitterReport(folder, status.device, status.milliseconds, status.rate, status.slowed, null, frames.fps, software, recording));
	}

	async run(visualizer: Visualizer, smoothness: Smoothness, recorder: ClipRecorder): Promise<void> {
		this.#visualizer = visualizer;
		this.#smoothness = smoothness;
		this.#recorder = recorder;
		smoothness.addEventListener("measure", event => this.#onMeasure(event.detail));
	}

	async catch(error: Error): Promise<void> {
		console.error(`Splitter collection failed:\n${error}`);
	}
}
//#endregion
