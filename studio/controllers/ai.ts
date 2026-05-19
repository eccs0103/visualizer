"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { Visualizer } from "../services/visualizer.js";
import { SceneDefinition } from "../models/audio-features.js";

//#region AI controller
export class AIController extends Controller<[visualizer: Visualizer, dialog: HTMLDialogElement]> {
	async run(visualizer: Visualizer, dialog: HTMLDialogElement): Promise<void> {
		const sceneLabel = dialog.getElement(HTMLSpanElement, "span#current-scene-label");
		const trainCount = dialog.getElement(HTMLSpanElement, "span#auto-train-count");
		const autoToggle = dialog.getElement(HTMLInputElement, "input#auto-train-toggle");
		const resetButton = dialog.getElement(HTMLButtonElement, "button#reset-model");
		const exportButton = dialog.getElement(HTMLButtonElement, "button#export-model");
		const trainButtons = SceneDefinition.names.map((_, index) => dialog.getElement(HTMLButtonElement, `button#train-scene-${index}`));

		visualizer.addEventListener("update", (event) => {
			const features = visualizer.audioset.features;
			const dspScene = features.dspScene;
			const sceneIndex = features.scene;
			const confidence = Math.round(features.sceneProbs[sceneIndex] * 100);
			sceneLabel.textContent = `${SceneDefinition.names[dspScene >= 0 ? dspScene : sceneIndex]}  ·  ${confidence}%`;
		});

		visualizer.analyzer.addEventListener("auto-progress", (event) => {
			trainCount.textContent = String(event.detail);
		});

		autoToggle.checked = true;
		autoToggle.addEventListener("input", (event) => {
			visualizer.analyzer.autoTrain = autoToggle.checked;
		});

		resetButton.addEventListener("click", (event) => {
			event.stopPropagation();
			visualizer.analyzer.resetWeights();
			trainCount.textContent = "0";
		});

		for (let index = 0; index < trainButtons.length; index++) {
			const index2 = index;
			trainButtons[index].addEventListener("click", (event) => {
				event.stopPropagation();
				visualizer.analyzer.train(index2);
			});
		}

		exportButton.addEventListener("click", (event) => {
			event.stopPropagation();
			visualizer.analyzer.exportWeights();
		});
	}
}
//#endregion
