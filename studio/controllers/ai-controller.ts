"use strict";

import "adaptive-extender/web";
import { BufferedCell, Controller } from "adaptive-extender/web";
import { Visualizer } from "../services/visualizer.js";
import { type Settings } from "../models/settings.js";

//#region AI controller
export class AIController extends Controller<[BufferedCell<typeof Settings>, Visualizer, HTMLDialogElement]> {
	async run(cell: BufferedCell<typeof Settings>, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement): Promise<void> {
		if (!visualizer.isDeveloper) return;

		const { analyzer } = visualizer;
		const settings = cell.content;

		const aiSeparator = dialogConfigurator.getElement(HTMLElement, "#ai-separator");
		const aiHeading = dialogConfigurator.getElement(HTMLElement, "#ai-heading");
		const aiReward = dialogConfigurator.getElement(HTMLElement, "#ai-reward");
		const aiFeedback = dialogConfigurator.getElement(HTMLElement, "#ai-feedback");
		const aiLearning = dialogConfigurator.getElement(HTMLElement, "#ai-learning");
		const aiReset = dialogConfigurator.getElement(HTMLElement, "#ai-reset");
		const aiExport = dialogConfigurator.getElement(HTMLElement, "#ai-export");
		const aiShareSection = dialogConfigurator.getElement(HTMLElement, "#ai-share");

		for (const element of [aiSeparator, aiHeading, aiReward, aiFeedback, aiLearning, aiReset, aiExport, aiShareSection]) element.hidden = false;

		const spanAiStepCount = dialogConfigurator.getElement(HTMLSpanElement, "span#ai-step-count");
		const buttonFeedbackGood = dialogConfigurator.getElement(HTMLButtonElement, "button#feedback-good");
		const buttonFeedbackBad = dialogConfigurator.getElement(HTMLButtonElement, "button#feedback-bad");
		const inputLearningToggle = dialogConfigurator.getElement(HTMLInputElement, "input#learning-toggle");
		const buttonResetModel = dialogConfigurator.getElement(HTMLButtonElement, "button#reset-model");
		const buttonExportModel = dialogConfigurator.getElement(HTMLButtonElement, "button#export-model");
		const buttonShareModel = dialogConfigurator.getElement(HTMLButtonElement, "button#share-model");

		analyzer.addEventListener("progress", (event) => {
			spanAiStepCount.textContent = String(event.detail);
		});

		buttonFeedbackGood.addEventListener("click", (event) => {
			analyzer.feedback(1);
		});

		buttonFeedbackBad.addEventListener("click", (event) => {
			analyzer.feedback(-1);
		});

		const autoTrain = settings.autoTrain === true;
		inputLearningToggle.checked = autoTrain;
		analyzer.setLearning(autoTrain);
		inputLearningToggle.addEventListener("input", async (event) => {
			const checked = inputLearningToggle.checked
			analyzer.setLearning(checked);
			settings.autoTrain = checked;
			await cell.save(500);
		});

		buttonResetModel.addEventListener("click", (event) => {
			analyzer.resetWeights();
		});

		buttonExportModel.addEventListener("click", (event) => {
			analyzer.exportWeights();
		});

		buttonShareModel.addEventListener("click", (event) => {
			const title = "Weights submission";
			const isSuccesfull = (window.open(`https://github.com/eccs0103/visualizer/issues/new?title=${window.encodeURIComponent(title)}`, "_blank") !== null);
			if (!isSuccesfull) window.alert("Unable to open the submission page.");
		});
	}
}
//#endregion
