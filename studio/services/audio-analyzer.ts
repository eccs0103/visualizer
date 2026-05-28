"use strict";

import "adaptive-extender/web";
import { ArchiveRepository } from "adaptive-extender/web";
import { NNWeights } from "../models/nn-agent.js";
import { FeatureBridge } from "./feature-bridge.js";
import { ClientBridge } from "./client-bridge.js";
import { Scene, SceneDefinition } from "../models/audio-features.js";
import { type AudiosetManager } from "../models/audioset.js";
import { AutoProgressCommand, Command, InitializeCommand, LoadWeightsCommand, ResetCommand, SaveWeightsCommand, SetAutoTrainCommand, TrainCommand, WeightsCommand } from "../models/audio-analyzer-commands.js";

const { baseURI } = document;

//#region Audio analyser
export interface AudioAnalyzerEventMap {
	"auto-progress": CustomEvent<number>;
}

export interface AudioAnalyzerOptions {
	isDeveloper: boolean;
}

export class AudioAnalyzer extends EventTarget {
	#autoTrain: boolean = false;
	#isDeveloper: boolean;
	#repository: ArchiveRepository<typeof NNWeights> = new ArchiveRepository("Visualizer\\Studio\\NN weights", NNWeights, new NNWeights());
	#bridge: FeatureBridge = new FeatureBridge();
	#worker: Worker = new Worker(new URL("./controllers/audio-analyzer-worker.ts", baseURI), { type: "module" });
	#rate: number;
	#pendingExport: boolean = false;

	constructor(rate: number);
	constructor(rate: number, options: Partial<AudioAnalyzerOptions>);
	constructor(rate: number, options: Partial<AudioAnalyzerOptions> = {}) {
		super();

		this.#rate = rate;
		this.#isDeveloper = options.isDeveloper ?? false;

		const { inSAB, outSAB } = this.#bridge;
		const worker = this.#worker;
		worker.postMessage(Command.export(new InitializeCommand(inSAB, outSAB)));
		worker.addEventListener("message", this.#onMessage.bind(this));
		void this.#loadWeights();
	}

	addEventListener<K extends keyof AudioAnalyzerEventMap>(type: K, listener: (this: Document, ev: AudioAnalyzerEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof AudioAnalyzerEventMap>(type: K, listener: (this: Document, ev: AudioAnalyzerEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		return super.removeEventListener(type, listener, options);
	}

	get isDeveloper(): boolean { return this.#isDeveloper; }
	get autoTrain(): boolean { return this.#autoTrain; }

	set autoTrain(enabled: boolean) {
		if (!this.#isDeveloper) return;
		if (this.#autoTrain === enabled) return;
		this.#autoTrain = enabled;
		this.#worker.postMessage(Command.export(new SetAutoTrainCommand(enabled)));
	}

	analyze(manager: AudiosetManager): void {
		const bridge = this.#bridge;
		manager.readFeatures(bridge.output);
		const { length, volume, amplitude, dataFrequency, dataTemporal } = manager.audioset;
		bridge.writeInput(length, this.#rate, volume, amplitude, dataFrequency, dataTemporal);
	}

	train(scene: Scene): void {
		if (!this.#isDeveloper) return;
		const worker = this.#worker;
		worker.postMessage(Command.export(new TrainCommand(SceneDefinition.indexOf(scene))));
		worker.postMessage(Command.export(new SaveWeightsCommand()));
	}

	teach(scene: Scene): void {
		if (!this.#isDeveloper) return;
		this.#worker.postMessage(Command.export(new TrainCommand(SceneDefinition.indexOf(scene))));
	}

	exportWeights(): void {
		if (!this.#isDeveloper) return;
		this.#pendingExport = true;
		this.#worker.postMessage(Command.export(new SaveWeightsCommand()));
	}

	resetWeights(): void {
		if (!this.#isDeveloper) return;
		this.#worker.postMessage(Command.export(new ResetCommand()));
		this.#repository.reset();
	}

	async #loadWeights(): Promise<void> {
		const worker = this.#worker;
		let weights = this.#repository.content;
		if (weights.matrix1.length > 0) {
			worker.postMessage(Command.export(new LoadWeightsCommand(weights)));
			return;
		}
		const bridge = new ClientBridge();
		const content = await bridge.read(new URL("../data/nn-weights.json", baseURI));
		if (content === null) return;
		weights = NNWeights.import(JSON.parse(content), "nn-weights");
		worker.postMessage(Command.export(new LoadWeightsCommand(weights)));
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof WeightsCommand) {
			const repository = this.#repository;
			const cached = repository.content;
			const { weights } = command;
			cached.matrix1 = weights.matrix1;
			cached.bias1 = weights.bias1;
			cached.matrix2 = weights.matrix2;
			cached.bias2 = weights.bias2;
			cached.matrix3 = weights.matrix3;
			cached.bias3 = weights.bias3;
			void repository.save(2000).catch(() => { });
			if (this.#pendingExport) {
				this.#pendingExport = false;
				this.#downloadFile("nn-weights.json", JSON.stringify(NNWeights.export(weights)));
			}
			return;
		}

		if (command instanceof AutoProgressCommand) {
			this.dispatchEvent(new CustomEvent("auto-progress", { detail: command.count }));
		}
	}

	#downloadFile(name: string, content: string): void {
		const blob = new Blob([content], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = name;
		anchor.click();
		URL.revokeObjectURL(url);
	}
}
//#endregion
