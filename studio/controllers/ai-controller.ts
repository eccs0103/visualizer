"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { Visualizer } from "../services/visualizer.js";
import { SceneDefinition } from "../models/audio-features.js";

const { round } = Math;

//#region AI controller
export class AIController extends Controller<[Visualizer, HTMLDialogElement]> {
	async run(visualizer: Visualizer, dialogConfigurator: HTMLDialogElement): Promise<void> {
		const { analyzer } = visualizer;
		const spanCurrentSceneLabel = dialogConfigurator.getElement(HTMLSpanElement, "span#current-scene-label");
		const spanAutoTrainCount = dialogConfigurator.getElement(HTMLSpanElement, "span#auto-train-count");
		const inputAutoTrainToggle = dialogConfigurator.getElement(HTMLInputElement, "input#auto-train-toggle");
		const buttonResetModel = dialogConfigurator.getElement(HTMLButtonElement, "button#reset-model");
		const buttonExportModel = dialogConfigurator.getElement(HTMLButtonElement, "button#export-model");
		const buttonsTrainScene = SceneDefinition.names.map((_, index) => dialogConfigurator.getElement(HTMLButtonElement, `button#train-scene-${index}`));

		visualizer.addEventListener("update", (event) => {
			const { sceneProbs, scene, dspScene } = visualizer.audioset;
			const confidence = round(sceneProbs[scene] * 100);
			spanCurrentSceneLabel.textContent = `${SceneDefinition.names[dspScene >= 0 ? dspScene : scene]} · ${confidence}%`;
		});

		analyzer.addEventListener("auto-progress", (event) => {
			spanAutoTrainCount.textContent = String(event.detail);
		});

		inputAutoTrainToggle.checked = false;
		inputAutoTrainToggle.addEventListener("input", (event) => {
			analyzer.autoTrain = inputAutoTrainToggle.checked;
		});

		buttonResetModel.addEventListener("click", (event) => {
			event.stopPropagation();
			analyzer.resetWeights();
			spanAutoTrainCount.textContent = String(0);
		});

		for (let index = 0; index < buttonsTrainScene.length; index++) {
			const index2 = index;
			buttonsTrainScene[index].addEventListener("click", (event) => {
				event.stopPropagation();
				analyzer.train(index2);
			});
		}

		buttonExportModel.addEventListener("click", (event) => {
			event.stopPropagation();
			analyzer.exportWeights();
		});
	}
}
//#endregion
