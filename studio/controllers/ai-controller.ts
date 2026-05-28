"use strict";

import "adaptive-extender/web";
import { ArchiveRepository, Controller } from "adaptive-extender/web";
import { Visualizer } from "../services/visualizer.js";
import { Scene, SceneDefinition } from "../models/audio-features.js";
import { type Settings } from "../models/settings.js";

const { round } = Math;

//#region AI controller
export class AIController extends Controller<[ArchiveRepository<typeof Settings>, Visualizer, HTMLDialogElement]> {
	#visualizer: Visualizer;
	#sceneSelection: Scene | null = null;
	#buttonsTrainScene: HTMLButtonElement[];
	#emaConfidence: number = 0;
	#spanModelConfidence: HTMLSpanElement;

	static #setSceneTraining(button: HTMLButtonElement, value: boolean): void {
		const { dataset } = button;
		if (value) dataset["active"] = String.empty;
		else delete dataset["active"];
	}

	#markTrainingSelection(scene: Scene | null) {
		const sceneSelection = this.#sceneSelection;
		const buttonsTrainScene = this.#buttonsTrainScene;

		if (sceneSelection !== null) {
			const buttonTrainScene = buttonsTrainScene[SceneDefinition.indexOf(sceneSelection)];
			AIController.#setSceneTraining(buttonTrainScene, false);
		}

		if (scene !== null) {
			const buttonTrainScene = buttonsTrainScene[SceneDefinition.indexOf(scene)];
			AIController.#setSceneTraining(buttonTrainScene, true);
		}
	}

	static #setScenePrediction(button: HTMLButtonElement, value: boolean): void {
		const { dataset } = button;
		if (value) dataset["predicted"] = String.empty;
		else delete dataset["predicted"];
	}

	#newSceneButton(itemContainer: HTMLElement, scene: Scene): HTMLButtonElement {
		const { analyzer } = this.#visualizer;

		const button = itemContainer.appendChild(document.createElement("button"));
		button.type = "button";
		button.classList.add("scene-button", "rounded", "depth", "with-padding");
		button.textContent = String(scene);
		button.addEventListener("click", (event) => {
			analyzer.train(scene);
			const newScene = (this.#sceneSelection === scene ? null : scene);
			this.#markTrainingSelection(newScene);
			this.#sceneSelection = newScene;
		});
		return button;
	}

	#onVisualizerUpdate(): void {
		const { audioset, autoCorrect, analyzer } = this.#visualizer;
		const buttonsTrainScene = this.#buttonsTrainScene;
		const spanModelConfidence = this.#spanModelConfidence;

		debugger;
		for (const [scene, probability] of audioset.probabilities) {
			const buttonTrainScene = buttonsTrainScene[SceneDefinition.indexOf(scene)];
			AIController.#setScenePrediction(buttonTrainScene, autoCorrect && scene === audioset.scene);
			buttonTrainScene.style.setProperty("--probability", String(autoCorrect ? probability : 0));
		}

		const emaConfidence = this.#emaConfidence * 0.97 + audioset.confidence * 0.03;
		this.#emaConfidence = autoCorrect ? emaConfidence : 0;

		spanModelConfidence.textContent = (autoCorrect ? `${round(emaConfidence * 100)}%` : "—");

		const sceneSelection = this.#sceneSelection;
		if (sceneSelection !== null) analyzer.teach(sceneSelection);
	}

	async run(repository: ArchiveRepository<typeof Settings>, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement): Promise<void> {
		if (!visualizer.isDeveloper) return;

		this.#visualizer = visualizer;
		const { analyzer } = visualizer;
		const settings = repository.content;

		const aiSeparator = dialogConfigurator.getElement(HTMLElement, "#ai-separator");
		const aiHeading = dialogConfigurator.getElement(HTMLElement, "#ai-heading");
		const aiConfidence = dialogConfigurator.getElement(HTMLElement, "#ai-confidence");
		const aiScenes = dialogConfigurator.getElement(HTMLElement, "#ai-scenes");
		const aiAutoTrain = dialogConfigurator.getElement(HTMLElement, "#ai-auto-train");
		const aiProgress = dialogConfigurator.getElement(HTMLElement, "#ai-progress");
		const aiReset = dialogConfigurator.getElement(HTMLElement, "#ai-reset");
		const aiExport = dialogConfigurator.getElement(HTMLElement, "#ai-export");
		const aiShareSection = dialogConfigurator.getElement(HTMLElement, "#ai-share");

		for (const element of [aiSeparator, aiHeading, aiConfidence, aiScenes, aiAutoTrain, aiProgress, aiReset, aiExport, aiShareSection]) element.hidden = false;

		this.#spanModelConfidence = dialogConfigurator.getElement(HTMLSpanElement, "span#model-confidence");
		const divSceneControls = dialogConfigurator.getElement(HTMLDivElement, "div#scene-controls");
		this.#buttonsTrainScene = SceneDefinition.values.map(scene => this.#newSceneButton(divSceneControls, scene));
		const inputAutoTrainToggle = dialogConfigurator.getElement(HTMLInputElement, "input#auto-train-toggle");
		const spanAutoTrainCount = dialogConfigurator.getElement(HTMLSpanElement, "span#auto-train-count");
		const buttonResetModel = dialogConfigurator.getElement(HTMLButtonElement, "button#reset-model");
		const buttonExportModel = dialogConfigurator.getElement(HTMLButtonElement, "button#export-model");
		const buttonShareModel = dialogConfigurator.getElement(HTMLButtonElement, "button#share-model");

		visualizer.addEventListener("update", event => this.#onVisualizerUpdate());

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
			this.#sceneSelection = null;
			this.#markTrainingSelection(null);
			analyzer.resetWeights();
			spanAutoTrainCount.textContent = String(0);
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

	async catch(error: Error): Promise<void> {
		throw error;
	}
}
//#endregion
