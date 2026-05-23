"use strict";

import "adaptive-extender/web";
import { ArchiveRepository, Controller } from "adaptive-extender/web";
import { Visualizer } from "../services/visualizer.js";
import { SceneDefinition } from "../models/audio-features.js";
import { type Settings } from "../models/settings.js";

const { round } = Math;

//#region AI controller
export class AIController extends Controller<[ArchiveRepository<typeof Settings>, Visualizer, HTMLDialogElement]> {
	async run(repository: ArchiveRepository<typeof Settings>, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement): Promise<void> {
		const { analyzer } = visualizer;
		const settings = repository.content;

		const spanCurrentSceneLabel = dialogConfigurator.getElement(HTMLSpanElement, "span#current-scene-label");
		const spanAutoTrainCount = dialogConfigurator.getElement(HTMLSpanElement, "span#auto-train-count");
		const inputAutoTrainToggle = dialogConfigurator.getElement(HTMLInputElement, "input#auto-train-toggle");
		const buttonResetModel = dialogConfigurator.getElement(HTMLButtonElement, "button#reset-model");
		const buttonExportModel = dialogConfigurator.getElement(HTMLButtonElement, "button#export-model");
		const buttonsTrainScene = SceneDefinition.names.map((_, index) => dialogConfigurator.getElement(HTMLButtonElement, `button#train-scene-${index}`));
		const spanSceneProbabilities = SceneDefinition.names.map((_, index) => dialogConfigurator.getElement(HTMLElement, `small#scene-probability-${index}`));
		const spanModelConfidence = dialogConfigurator.getElement(HTMLSpanElement, "span#model-confidence");

		let rollingConfidence = 0;
		visualizer.addEventListener("update", (event) => {
			const { audioset } = visualizer;
			// const { dspScene } = audioset;
			// const sceneLabel = dspScene >= 0 ? SceneDefinition.fromIndex(dspScene) : audioset.scene;
			spanCurrentSceneLabel.textContent = `${audioset.scene} \u00B7 ${round(audioset.confidence * 100)}%`;
			for (const [scene, probability] of audioset.probabilities) {
				spanSceneProbabilities[SceneDefinition.indexOf(scene)].textContent = `${round(probability * 100)}%`;
			}
			rollingConfidence = rollingConfidence * 0.97 + audioset.confidence * 0.03;
			spanModelConfidence.textContent = `${round(rollingConfidence * 100)}%`;
		});

		analyzer.addEventListener("auto-progress", (event) => {
			spanAutoTrainCount.textContent = String(event.detail);
		});

		if (settings.autoTrain !== undefined) inputAutoTrainToggle.checked = settings.autoTrain;
		inputAutoTrainToggle.addEventListener("input", async (event) => {
			analyzer.autoTrain = inputAutoTrainToggle.checked;
			settings.autoTrain = analyzer.autoTrain;
			try { await repository.save(500); } catch { }
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
				analyzer.train(SceneDefinition.fromIndex(index2));
			});
		}

		buttonExportModel.addEventListener("click", (event) => {
			event.stopPropagation();
			analyzer.exportWeights();
		});
	}
}
//#endregion
