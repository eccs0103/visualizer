"use strict";

import "adaptive-extender/web";
import { Controller, ArchiveRepository, Timespan } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";
import { Visualizer } from "../services/visualizer.js";
import { ObjectStore } from "../services/object-store.js";
import { SceneDefinition } from "../models/audio-features.js";
import "../view/visualizations.js";

//#region Studio controller
class StudioController extends Controller {
	#repository: ArchiveRepository<typeof Settings> = new ArchiveRepository("Visualizer\\Studio\\Settings", Settings, Settings.newDefault);
	#store: ObjectStore = new ObjectStore("Visualizer", "Audiolist");

	#audioPlayer: HTMLAudioElement;
	#inputLoader: HTMLInputElement;
	#visualizer: Visualizer;
	#divInterface: HTMLDivElement;
	#buttonAudioDrive: HTMLButtonElement;
	#buttonOpenConfigurator: HTMLButtonElement;
	#bPlaybackTime: HTMLElement;
	#inputPlaybackTrack: HTMLInputElement;
	#dialogConfigurator: HTMLDialogElement;
	#buttonCloseConfigurator: HTMLButtonElement;
	#inputVisualizerRate: HTMLInputElement;
	#inputAutocorrectToggle: HTMLInputElement;
	#selectVisualizerVisualization: HTMLSelectElement;
	#inputVisualizationQuality: HTMLInputElement;
	#inputVisualizationSmoothing: HTMLInputElement;
	#inputVisualizationFocus: HTMLInputElement;
	#inputVisualizationSpread: HTMLInputElement;
	#buttonsTrainScene: HTMLButtonElement[] = [];
	#spanCurrentSceneLabel: HTMLSpanElement;
	#spanAutoTrainCount: HTMLSpanElement;
	#inputAutoTrainToggle: HTMLInputElement;
	#buttonResetModel: HTMLButtonElement;
	#buttonExportModel: HTMLButtonElement;

	get #markReady(): boolean {
		return this.#audioPlayer.dataset["ready"] !== undefined;
	}
	set #markReady(value: boolean) {
		const dataset = this.#audioPlayer.dataset;
		if (value) dataset["ready"] = String.empty;
		else delete dataset["ready"];
	}

	get #markPlaying(): boolean {
		return this.#audioPlayer.dataset["playing"] !== undefined;
	}
	set #markPlaying(value: boolean) {
		if (!this.#markReady) return;
		const dataset = this.#audioPlayer.dataset;
		if (value) dataset["playing"] = String.empty;
		else delete dataset["playing"];
	}

	async #playToggle(value: boolean): Promise<void> {
		const audioPlayer = this.#audioPlayer;
		if (value) await audioPlayer.play();
		else audioPlayer.pause();
	}

	static #toPlaytimeString(seconds: number): string {
		const time = Timespan.fromComponents(0, 0, seconds);
		const minute = time.days * 24 + time.hours * 60 + time.minutes;
		const second = time.seconds;
		return `${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`;
	}

	#toPlaytimeInfo(seconds: number): string {
		const audioPlayer = this.#audioPlayer;
		const current = StudioController.#toPlaytimeString(seconds);
		if (Number.isNaN(audioPlayer.duration)) return current;
		return `${current} • ${StudioController.#toPlaytimeString(audioPlayer.duration)}`;
	}

	async #loadAudio(file: File): Promise<void> {
		const audioPlayer = this.#audioPlayer;
		await Promise.withSignal((signal, resolve, reject) => {
			audioPlayer.addEventListener("canplay", event => resolve(), { signal });
			audioPlayer.addEventListener("error", event => reject(new Error("Failed to load audio file")), { signal });
			audioPlayer.src = URL.createObjectURL(file);
		});
	}

	#dropAudio(): void {
		const audioPlayer = this.#audioPlayer;
		audioPlayer.removeAttribute("src");
		audioPlayer.srcObject = null;
	}

	async #loadRecentAudio(): Promise<void> {
		const file = await this.#store.get(0);
		if (file === undefined || !(file instanceof File)) return;
		await this.#loadAudio(file);
	}

	async #saveRecentAudio(file: File | null): Promise<void> {
		const store = this.#store;
		if (file === null) {
			this.#dropAudio();
			await store.delete(0);
		} else {
			await this.#loadAudio(file);
			await store.put(0, file);
		}
	}

	#seekFactor(): number {
		const { value, min, max } = this.#inputPlaybackTrack;
		return Number(value).lerp(Number(min), Number(max));
	}

	async #setConfiguratorActivity(value: boolean): Promise<void> {
		const dialogConfigurator = this.#dialogConfigurator;
		const duration = 50;
		const fill: FillMode = "both";
		if (value) {
			dialogConfigurator.show();
			await dialogConfigurator.animate([{ opacity: "0", easing: "ease-in" }, { opacity: "1" }], { duration, fill }).finished;
		} else {
			await dialogConfigurator.animate([{ opacity: "1", easing: "ease-out" }, { opacity: "0" }], { duration, fill }).finished;
			dialogConfigurator.close();
		}
	}

	#useVisualization(): void {
		const settings = this.#repository.content;
		const visualizer = this.#visualizer;
		visualizer.visualization = this.#selectVisualizerVisualization.value;
		settings.visualizer.visualization = visualizer.visualization;
		visualizer.quality = settings.visualizer.configuration.quality;
		this.#inputVisualizationQuality.value = String(visualizer.quality);
		visualizer.smoothing = settings.visualizer.configuration.smoothing;
		this.#inputVisualizationSmoothing.value = String(visualizer.smoothing);
		visualizer.focus = settings.visualizer.configuration.focus;
		this.#inputVisualizationFocus.value = String(visualizer.focus);
		visualizer.spread = settings.visualizer.configuration.spread;
		this.#inputVisualizationSpread.value = String(visualizer.spread);
	}

	async #initView(): Promise<void> {
		const { body } = document;
		this.#audioPlayer = body.getElement(HTMLAudioElement, "audio#player");
		this.#inputLoader = body.getElement(HTMLInputElement, "input#audio-loader");
		const canvas = body.getElement(HTMLCanvasElement, "canvas#display");
		this.#visualizer = new Visualizer(canvas, this.#audioPlayer);
		const divInterface = this.#divInterface = body.getElement(HTMLDivElement, "div#interface");
		this.#buttonAudioDrive = divInterface.getElement(HTMLButtonElement, "button#audio-drive");
		this.#buttonOpenConfigurator = divInterface.getElement(HTMLButtonElement, "button#open-configurator");
		this.#bPlaybackTime = divInterface.getElement(HTMLElement, "b#playback-time");
		this.#inputPlaybackTrack = divInterface.getElement(HTMLInputElement, "input#playback-track");
		const dialogConfigurator = this.#dialogConfigurator = document.getElement(HTMLDialogElement, "dialog#configurator");
		this.#buttonCloseConfigurator = dialogConfigurator.getElement(HTMLButtonElement, "button#close-configurator");
		this.#inputVisualizerRate = dialogConfigurator.getElement(HTMLInputElement, "input#visualizer-rate");
		this.#inputAutocorrectToggle = dialogConfigurator.getElement(HTMLInputElement, "input#autocorrect-toggle");
		this.#selectVisualizerVisualization = dialogConfigurator.getElement(HTMLSelectElement, "select#visualizer-visualization");
		this.#inputVisualizationQuality = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-quality");
		this.#inputVisualizationSmoothing = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-smoothing");
		this.#inputVisualizationFocus = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-focus");
		this.#inputVisualizationSpread = dialogConfigurator.getElement(HTMLInputElement, "input#visualization-spread");

		// Training UI elements
		this.#buttonsTrainScene = SceneDefinition.names.map((_, i) => dialogConfigurator.getElement(HTMLButtonElement, `button#train-scene-${i}`),);
		this.#spanCurrentSceneLabel = dialogConfigurator.getElement(HTMLSpanElement, "span#current-scene-label");
		this.#spanAutoTrainCount = dialogConfigurator.getElement(HTMLSpanElement, "span#auto-train-count");
		this.#inputAutoTrainToggle = dialogConfigurator.getElement(HTMLInputElement, "input#auto-train-toggle");
		this.#buttonResetModel = dialogConfigurator.getElement(HTMLButtonElement, "button#reset-model");
		this.#buttonExportModel = dialogConfigurator.getElement(HTMLButtonElement, "button#export-model");
	}

	async #runViewInitialization(): Promise<void> {
		const repository = this.#repository;
		const settings = repository.content;
		const audioPlayer = this.#audioPlayer;
		const inputLoader = this.#inputLoader;
		const visualizer = this.#visualizer;
		const bPlaybackTime = this.#bPlaybackTime;
		const inputPlaybackTrack = this.#inputPlaybackTrack;
		const dialogConfigurator = this.#dialogConfigurator;
		const rateInput = this.#inputVisualizerRate;
		const inputAutocorrectToggle = this.#inputAutocorrectToggle;
		const selectVisualizerVisualization = this.#selectVisualizerVisualization;
		const inputVisualizationQuality = this.#inputVisualizationQuality;
		const inputVisualizationSmoothing = this.#inputVisualizationSmoothing;
		const inputVisualizationFocus = this.#inputVisualizationFocus;
		const inputVisualizationSpread = this.#inputVisualizationSpread;

		audioPlayer.addEventListener("canplay", event => this.#markReady = true);
		audioPlayer.addEventListener("emptied", event => this.#markReady = false);
		audioPlayer.addEventListener("play", event => this.#markPlaying = true);
		audioPlayer.addEventListener("pause", event => this.#markPlaying = false);

		visualizer.rate = settings.visualizer.rate;
		visualizer.autocorrect = settings.visualizer.autocorrect;
		visualizer.visualization = settings.visualizer.visualization;
		visualizer.quality = settings.visualizer.configuration.quality;
		visualizer.smoothing = settings.visualizer.configuration.smoothing;
		visualizer.focus = settings.visualizer.configuration.focus;
		visualizer.spread = settings.visualizer.configuration.spread;

		await this.#loadRecentAudio();
		inputLoader.addEventListener("input", async (event) => {
			try {
				const files = ReferenceError.suppress(inputLoader.files, "Unable to read files list");
				const file = files.item(0);
				if (file === null) return;
				await this.#saveRecentAudio(file);
			} catch (reason) {
				await this.catch(Error.from(reason));
			} finally {
				bPlaybackTime.innerText = this.#toPlaytimeInfo(audioPlayer.currentTime);
				inputLoader.value = String.empty;
			}
		});

		this.#divInterface.addEventListener("click", async (event) => {
			if (audioPlayer.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
			event.stopImmediatePropagation();
			await this.#playToggle(audioPlayer.paused);
		});

		this.#buttonAudioDrive.addEventListener("click", async (event) => {
			event.stopPropagation();
			if (audioPlayer.readyState === HTMLMediaElement.HAVE_NOTHING) inputLoader.click();
			else await this.#saveRecentAudio(null);
		});

		this.#buttonOpenConfigurator.addEventListener("click", async (event) => {
			event.stopPropagation();
			await this.#setConfiguratorActivity(true);
			settings.isOpenedConfigurator = dialogConfigurator.open;
			await repository.save(500);
		});

		audioPlayer.addEventListener("timeupdate", (event) => {
			if (document.activeElement === inputPlaybackTrack) return;
			const factor = (audioPlayer.currentTime / audioPlayer.duration).insteadNaN(0);
			inputPlaybackTrack.value = `${factor * 100}`;
			inputPlaybackTrack.style.setProperty("--track-value", `${factor * 100}%`);
			bPlaybackTime.innerText = this.#toPlaytimeInfo(audioPlayer.currentTime);
		});
		inputPlaybackTrack.addEventListener("pointerup", (event) => inputPlaybackTrack.blur());

		const updateSeekTrack = (): void => {
			const factor = this.#seekFactor();
			inputPlaybackTrack.style.setProperty("--track-value", `${factor * 100}%`);
			const time = (audioPlayer.duration * factor).insteadNaN(0);
			bPlaybackTime.innerText = this.#toPlaytimeInfo(time);
		};
		inputPlaybackTrack.addEventListener("input", (event) => {
			if (audioPlayer.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
			updateSeekTrack();
		});
		inputPlaybackTrack.addEventListener("change", (event) => {
			if (audioPlayer.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
			updateSeekTrack();
			audioPlayer.currentTime = (audioPlayer.duration * this.#seekFactor()).insteadNaN(0);
		});

		await this.#setConfiguratorActivity(settings.isOpenedConfigurator);
		this.#buttonCloseConfigurator.addEventListener("click", async (event) => {
			await this.#setConfiguratorActivity(false);
			settings.isOpenedConfigurator = dialogConfigurator.open;
			await repository.save(500);
		});

		rateInput.value = String(visualizer.rate);
		rateInput.addEventListener("change", async (event) => {
			visualizer.rate = Number(rateInput.value);
			rateInput.value = String(visualizer.rate);
			settings.visualizer.rate = visualizer.rate;
			await repository.save(500);
		});

		for (const visualization of Visualizer.visualizations) {
			const option = selectVisualizerVisualization.appendChild(document.createElement("option"));
			option.value = visualization;
			option.innerText = visualization;
		}
		selectVisualizerVisualization.value = visualizer.visualization;
		selectVisualizerVisualization.addEventListener("change", event => this.#useVisualization());

		inputVisualizationQuality.value = String(visualizer.quality);
		inputVisualizationQuality.addEventListener("change", async (event) => {
			visualizer.quality = Number(inputVisualizationQuality.value);
			inputVisualizationQuality.value = String(visualizer.quality);
			settings.visualizer.configuration.quality = visualizer.quality;
			await repository.save(500);
		});

		inputVisualizationSmoothing.value = String(visualizer.smoothing);
		inputVisualizationSmoothing.addEventListener("input", (event) => {
			visualizer.smoothing = Number(inputVisualizationSmoothing.value);
		});
		inputVisualizationSmoothing.addEventListener("change", async (event) => {
			settings.visualizer.configuration.smoothing = visualizer.smoothing;
			await repository.save(500);
		});

		inputVisualizationFocus.value = String(visualizer.focus);
		inputVisualizationFocus.disabled = visualizer.autocorrect;
		inputVisualizationFocus.addEventListener("input", (event) => {
			visualizer.focus = Number(inputVisualizationFocus.value);
		});
		inputVisualizationFocus.addEventListener("change", async (event) => {
			settings.visualizer.configuration.focus = visualizer.focus;
			await repository.save(500);
		});

		inputVisualizationSpread.value = String(visualizer.spread);
		inputVisualizationSpread.disabled = visualizer.autocorrect;
		inputVisualizationSpread.addEventListener("input", (event) => {
			visualizer.spread = Number(inputVisualizationSpread.value);
		});
		inputVisualizationSpread.addEventListener("change", async (event) => {
			settings.visualizer.configuration.spread = visualizer.spread;
			await repository.save(500);
		});

		visualizer.addEventListener("update", async (event) => {
			if (!visualizer.autocorrect) return;
			inputVisualizationFocus.value = String(visualizer.focus);
			settings.visualizer.configuration.focus = visualizer.focus;
			inputVisualizationSpread.value = String(visualizer.spread);
			settings.visualizer.configuration.spread = visualizer.spread;
			// void repository.save(500).catch(() => { });
		});

		inputAutocorrectToggle.checked = visualizer.autocorrect;
		inputAutocorrectToggle.addEventListener("input", (event) => {
			visualizer.autocorrect = inputAutocorrectToggle.checked;
			inputVisualizationFocus.disabled = visualizer.autocorrect;
			inputVisualizationSpread.disabled = visualizer.autocorrect;
		});
		inputAutocorrectToggle.addEventListener("change", async (event) => {
			settings.visualizer.autocorrect = visualizer.autocorrect;
			await repository.save(500);
		});

		const spanCurrentSceneLabel = this.#spanCurrentSceneLabel;
		visualizer.addEventListener("update", (event) => {
			const features = visualizer.analyzer.features;
			const dspScene = features.dspScene;
			const sceneIndex = features.scene;
			const confidence = Math.round(features.sceneProbs[sceneIndex] * 100);
			spanCurrentSceneLabel.textContent = `${SceneDefinition.names[dspScene >= 0 ? dspScene : sceneIndex]}  ·  ${confidence}%`;
		});

		const spanAutoTrainCount = this.#spanAutoTrainCount;
		visualizer.analyzer.addEventListener("auto-progress", (event) => {
			spanAutoTrainCount.textContent = String(event.detail);
		});

		const inputAutoTrainToggle = this.#inputAutoTrainToggle;
		inputAutoTrainToggle.checked = true;
		inputAutoTrainToggle.addEventListener("input", (event) => {
			visualizer.analyzer.autoTrain = inputAutoTrainToggle.checked;
		});

		this.#buttonResetModel.addEventListener("click", (event) => {
			event.stopPropagation();
			visualizer.analyzer.resetWeights();
			spanAutoTrainCount.textContent = "0";
		});

		const buttonsTrainScene = this.#buttonsTrainScene;
		for (let index = 0; index < buttonsTrainScene.length; index++) {
			const index2 = index;
			buttonsTrainScene[index].addEventListener("click", (event) => {
				event.stopPropagation();
				visualizer.analyzer.train(index2);
			});
		}

		this.#buttonExportModel.addEventListener("click", (event) => {
			event.stopPropagation();
			visualizer.analyzer.exportWeights();
		});
	}

	async #runViewKeybindings(): Promise<void> {
		const repository = this.#repository;
		const settings = repository.content;
		const audioPlayer = this.#audioPlayer;
		const dialogConfigurator = this.#dialogConfigurator;
		const selectVisualizerVisualization = this.#selectVisualizerVisualization;

		window.addEventListener("keydown", async (event) => {
			if (event.code !== "Space") return;
			event.preventDefault();
			await this.#playToggle(audioPlayer.paused);
		});

		window.addEventListener("keydown", async (event) => {
			if (event.shiftKey || event.code !== "Tab") return;
			event.preventDefault();
			await this.#setConfiguratorActivity(!dialogConfigurator.open);
			settings.isOpenedConfigurator = dialogConfigurator.open;
			await repository.save(500);
		});

		window.addEventListener("keydown", (event) => {
			if (!event.shiftKey || event.code !== "Tab") return;
			event.preventDefault();
			selectVisualizerVisualization.selectedIndex = (selectVisualizerVisualization.selectedIndex + 1) % selectVisualizerVisualization.length;
			this.#useVisualization();
		});
	}

	async run(): Promise<void> {
		await this.#initView();
		await this.#runViewInitialization();
		await this.#runViewKeybindings();
	}

	async catch(error: Error): Promise<void> {
		const message = `${error}\n\nAn error occurred. Any further actions may result in errors. To prevent this from happening, would you like to reload?`;
		if (window.confirm(message)) location.reload();
	}
}
//#endregion

await StudioController.launch();
