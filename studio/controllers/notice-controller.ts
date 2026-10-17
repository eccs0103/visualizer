"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { type Visualizer } from "../services/visualizer.js";
import { type Smoothness, type FrameRate } from "../services/smoothness.js";
import { type ClipRecorder } from "../services/clip-recorder.js";
import { UnavailableStatus } from "../models/splitter-status.js";

//#region Notice controller
enum NoticeKind {
	software,
	slow,
	unavailable,
}

export class NoticeController extends Controller<[Visualizer, Smoothness, ClipRecorder, HTMLButtonElement, HTMLDialogElement]> {
	#details: Map<NoticeKind, string> = new Map();
	#visualizer: Visualizer;
	#smoothness: Smoothness;
	#recorder: ClipRecorder;
	#buttonNotice: HTMLButtonElement;
	#bNoticeText: HTMLElement;
	#outputVisualizerSmoothness: HTMLOutputElement;

	#label(kind: NoticeKind): string {
		switch (kind) {
		case NoticeKind.software: return "Graphics acceleration is off";
		case NoticeKind.slow: return this.#recorder.isRecording ? "Recording stutters" : "Running slowly";
		case NoticeKind.unavailable: return "AI unavailable";
		default: throw new TypeError(`Invalid '${kind}' notice`);
		}
	}

	#render(): void {
		const buttonNotice = this.#buttonNotice;
		const details = this.#details;
		const [kind] = details.keys();
		buttonNotice.hidden = kind === undefined;
		if (kind === undefined) return buttonNotice.removeAttribute("title");
		this.#bNoticeText.innerText = this.#label(kind);
		buttonNotice.title = Array.from(details.values()).join("\n\n");
	}

	#judgeSoftware(): void {
		if (!this.#smoothness.software) return;
		this.#details.set(NoticeKind.software, "Graphics acceleration is off, so the browser draws everything on the processor. Turn on \"Use graphics acceleration when available\" in the browser settings and restart the browser.");
	}

	#judgeSlow(): void {
		const details = this.#details;
		details.delete(NoticeKind.slow);
		if (!this.#smoothness.slow) return;
		const cause = this.#recorder.isRecording ? "The computer can't keep up with recording, so the clip will stutter." : "The computer can't keep up, so the picture stutters.";
		details.set(NoticeKind.slow, `${cause} A lower Rate or Quality, or the AI off, makes it lighter.`);
	}

	#judgeSplitter(): void {
		const details = this.#details;
		details.delete(NoticeKind.unavailable);
		const { status } = this.#visualizer.splitter;
		if (!(status instanceof UnavailableStatus)) return;
		details.set(NoticeKind.unavailable, `The AI can't run here. ${status.reason}`);
	}

	#refreshFrames(frames: FrameRate): void {
		const outputVisualizerSmoothness = this.#outputVisualizerSmoothness;
		outputVisualizerSmoothness.classList.toggle("warn", this.#smoothness.slow);
		outputVisualizerSmoothness.value = `${frames.fps} of normal ${frames.normal}\nframes/s`;
	}

	#refreshSlow(): void {
		this.#judgeSlow();
		this.#outputVisualizerSmoothness.classList.toggle("warn", this.#smoothness.slow);
		this.#render();
	}

	#refreshSplitter(): void {
		this.#judgeSplitter();
		this.#render();
	}

	async run(visualizer: Visualizer, smoothness: Smoothness, recorder: ClipRecorder, buttonNotice: HTMLButtonElement, dialogConfigurator: HTMLDialogElement): Promise<void> {
		this.#visualizer = visualizer;
		this.#smoothness = smoothness;
		this.#recorder = recorder;
		this.#buttonNotice = buttonNotice;
		this.#bNoticeText = buttonNotice.getElement(HTMLElement, "b#notice-text");
		this.#outputVisualizerSmoothness = dialogConfigurator.getElement(HTMLOutputElement, "output#visualizer-smoothness");

		smoothness.addEventListener("measure", event => this.#refreshFrames(event.detail));
		smoothness.addEventListener("change", event => this.#refreshSlow());
		visualizer.splitter.addEventListener("status", event => this.#refreshSplitter());
		recorder.addEventListener("start", event => this.#refreshSlow());
		recorder.addEventListener("stop", event => this.#refreshSlow());

		this.#judgeSoftware();
		this.#judgeSplitter();
		this.#refreshSlow();
	}
}
//#endregion
