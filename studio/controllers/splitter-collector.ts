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
	static #windows: number = 10;

	#visualizer: Visualizer;
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
		const visualizer = this.#visualizer;
		const { model, status } = visualizer.splitter;
		const { accelerated } = visualizer;
		const recording = this.#recorder.isRecording;
		if (status instanceof UnavailableStatus) return this.#send(status.reason, SplitterReport.unavailable(model, status, frames.fps, accelerated, recording));
		if (!(status instanceof ActiveStatus) || model === null) return;
		const { folder } = model;
		const counts = this.#counts;
		const count = (counts.get(folder) ?? 0) + 1;
		counts.set(folder, count);
		if (count < SplitterCollector.#windows) return;
		this.#send(folder, SplitterReport.active(model, status, frames.fps, accelerated, recording));
	}

	async run(visualizer: Visualizer, smoothness: Smoothness, recorder: ClipRecorder): Promise<void> {
		this.#visualizer = visualizer;
		this.#recorder = recorder;
		smoothness.addEventListener("measure", event => this.#onMeasure(event.detail));
	}
}
//#endregion
