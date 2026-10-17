"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { type Visualizer } from "../services/visualizer.js";
import { type Smoothness } from "../services/smoothness.js";
import { type ClipRecorder } from "../services/clip-recorder.js";
import { UnavailableStatus } from "../models/splitter-status.js";

//#region Notice controller
export class NoticeController extends Controller<[Visualizer, Smoothness, ClipRecorder, HTMLDivElement]> {
	#visualizer: Visualizer;
	#smoothness: Smoothness;
	#recorder: ClipRecorder;
	#buttonNotice: HTMLButtonElement;
	#bNoticeText: HTMLElement;

	#notices(): (readonly [string, string])[] {
		const visualizer = this.#visualizer;
		const { status } = visualizer.splitter;
		const notices: (readonly [string, string])[] = [];
		if (!visualizer.accelerated) notices.push(["Graphics acceleration is off", "Graphics acceleration is off, so the browser draws everything on the processor. Turn on \"Use graphics acceleration when available\" in the browser settings and restart the browser."]);
		if (this.#smoothness.slow) {
			if (this.#recorder.isRecording) notices.push(["Recording stutters", "The computer can't keep up with recording, so the clip will stutter. A lower Rate or Quality, or the AI off, makes it lighter."]);
			else notices.push(["Running slowly", "The computer can't keep up, so the picture stutters. A lower Rate or Quality, or the AI off, makes it lighter."]);
		}
		if (status instanceof UnavailableStatus) notices.push(["AI unavailable", `The AI can't run here. ${status.reason}`]);
		return notices;
	}

	#render(): void {
		const buttonNotice = this.#buttonNotice;
		const notices = this.#notices();
		buttonNotice.hidden = notices.length < 1;
		if (notices.length < 1) return buttonNotice.removeAttribute("title");
		this.#bNoticeText.innerText = notices[0][0];
		buttonNotice.title = notices.map(([, detail]) => detail).join("\n\n");
	}

	async run(visualizer: Visualizer, smoothness: Smoothness, recorder: ClipRecorder, divInterface: HTMLDivElement): Promise<void> {
		this.#visualizer = visualizer;
		this.#smoothness = smoothness;
		this.#recorder = recorder;
		const buttonNotice = this.#buttonNotice = divInterface.getElement(HTMLButtonElement, "button#notice");
		this.#bNoticeText = buttonNotice.getElement(HTMLElement, "b#notice-text");

		smoothness.addEventListener("change", event => this.#render());
		visualizer.splitter.addEventListener("status", event => this.#render());
		recorder.addEventListener("start", event => this.#render());
		recorder.addEventListener("stop", event => this.#render());
		this.#render();
	}
}
//#endregion
