"use strict";

import "adaptive-extender/web";
import { ArchiveRepository } from "adaptive-extender/web";
import { NNWeights } from "../models/nn-agent.js";
import { FeatureBridge } from "./feature-bridge.js";
import { ClientBridge } from "./client-bridge.js";
import { Scene, SceneDefinition } from "../models/audio-features.js";
import { type AudiosetManager } from "../models/audioset.js";

const { baseURI } = document;

//#region Audio analyser
type WorkerResponse =
	| { type: "weights"; weights: NNWeights; }
	| { type: "auto-progress"; count: number; };

export interface AudioAnalyzerEventMap {
	"auto-progress": CustomEvent<number>;
}

export class AudioAnalyzer extends EventTarget {
	#autoTrain: boolean = false;
	#repository: ArchiveRepository<typeof NNWeights> = new ArchiveRepository("Visualizer\\Studio\\NN weights", NNWeights, new NNWeights());
	#bridge: FeatureBridge = new FeatureBridge();
	#worker: Worker = new Worker(new URL("./controllers/audio-analyzer-worker.ts", baseURI), { type: "module" });
	#rate: number;
	#pendingExport: boolean = false;

	constructor(rate: number) {
		super();
		this.#rate = rate;
		const { inSAB, outSAB } = this.#bridge;
		const worker = this.#worker;
		worker.postMessage({ type: "init", inSAB, outSAB });
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

	get autoTrain(): boolean {
		return this.#autoTrain;
	}

	set autoTrain(enabled: boolean) {
		if (this.#autoTrain === enabled) return;
		this.#autoTrain = enabled;
		this.#worker.postMessage({ type: "set-auto-train", enabled });
	}

	analyze(manager: AudiosetManager): void {
		manager.readFeatures(this.#bridge.output);
		const { audioset } = manager;
		this.#bridge.writeInput(audioset.length, this.#rate, audioset.normVolume, audioset.normAmplitude, audioset.normsDataFrequency, audioset.normsDataTemporal);
	}

	train(scene: Scene): void {
		const worker = this.#worker;
		worker.postMessage({ type: "train", label: SceneDefinition.indexOf(scene) });
		worker.postMessage({ type: "save-weights" });
	}

	exportWeights(): void {
		this.#pendingExport = true;
		this.#worker.postMessage({ type: "save-weights" });
	}

	resetWeights(): void {
		this.#worker.postMessage({ type: "reset" });
		this.#repository.reset();
	}

	async #loadWeights(): Promise<void> {
		const worker = this.#worker;
		let weights = this.#repository.content;
		if (weights.matrix1.length > 0) {
			worker.postMessage({ type: "load-weights", weights });
			return;
		}
		const bridge = new ClientBridge();
		const content = await bridge.read(new URL("../data/nn-weights.json", baseURI));
		if (content === null) return;
		weights = NNWeights.import(JSON.parse(content), "nn-weights");
		worker.postMessage({ type: "load-weights", weights });
	}

	#onMessage(event: MessageEvent): void {
		const data = event.data as WorkerResponse;
		if (data.type === "weights") {
			const repository = this.#repository;
			const weights = NNWeights.import(data.weights, "weights");
			const cached = repository.content;
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
		if (data.type === "auto-progress") {
			this.dispatchEvent(new CustomEvent("auto-progress", { detail: data.count }));
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
