"use strict";

import "adaptive-extender/web";
import { Controller, Timespan } from "adaptive-extender/web";
import { Visualizer } from "../services/visualizer.js";
import { ClipRecorder } from "../services/clip-recorder.js";
import { WakeGuard } from "../services/wake-guard.js";
import { TextExpert } from "../services/text-expert.js";

//#region Clip controller
export class ClipController extends Controller<[WakeGuard, Visualizer, HTMLCanvasElement, HTMLAudioElement, HTMLButtonElement, HTMLElement]> {
	static #zero: Timespan = Timespan.newZero;
	#recorder: ClipRecorder;
	#buttonClipToggle: HTMLButtonElement;
	#itemClipTime: HTMLElement;

	#markRecording(value: boolean): void {
		const { dataset } = this.#buttonClipToggle;
		const itemClipTime = this.#itemClipTime;

		if (value) dataset["recording"] = String.empty;
		else delete dataset["recording"];
		itemClipTime.hidden = !value;
		if (!value) itemClipTime.innerText = TextExpert.formatDuration(ClipController.#zero);
	}

	async #setRecording(value: boolean): Promise<void> {
		const recorder = this.#recorder;
		if (value) return await recorder.start();
		const file = await recorder.stop();
		file.download();
	}

	async #toggleRecording(): Promise<void> {
		const recorder = this.#recorder;
		const buttonClipToggle = this.#buttonClipToggle;
		buttonClipToggle.disabled = true;
		try {
			await this.#setRecording(!recorder.isRecording);
		} catch (reason) {
			console.error(Error.from(reason));
		} finally {
			this.#markRecording(recorder.isRecording);
			buttonClipToggle.disabled = false;
		}
	}

	async run(guard: WakeGuard, visualizer: Visualizer, canvasDisplay: HTMLCanvasElement, audioPlayer: HTMLAudioElement, buttonClipToggle: HTMLButtonElement, itemClipTime: HTMLElement): Promise<void> {
		const recorder = this.#recorder = new ClipRecorder(canvasDisplay, audioPlayer);

		this.#buttonClipToggle = buttonClipToggle;
		this.#itemClipTime = itemClipTime;

		recorder.addEventListener("start", event => guard.activate("recording"));
		recorder.addEventListener("stop", event => guard.deactivate("recording"));
		recorder.addEventListener("tick", (event) => {
			itemClipTime.innerText = TextExpert.formatDuration(event.detail);
		});
		visualizer.addEventListener("update", event => recorder.tick());
		buttonClipToggle.addEventListener("click", async (event) => {
			event.stopPropagation();
			await this.#toggleRecording();
		});

		this.#markRecording(recorder.isRecording);
	}
}
//#endregion
