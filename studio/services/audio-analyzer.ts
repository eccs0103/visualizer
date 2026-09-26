"use strict";

import "adaptive-extender/web";
import { BufferedCell } from "adaptive-extender/web";
import { NNWeights } from "../models/nn-agent.js";
import { StemMasks } from "../models/audio-features.js";
import { Calibration } from "../models/calibration.js";
import { FeatureBridge } from "./feature-bridge.js";
import { ClientBridge } from "./client-bridge.js";
import { ActivityCommand, AttachMasksCommand, Command, FeedbackCommand, InitializeCommand, LearningCommand, LoadCalibrationCommand, LoadMaskModelCommand, LoadWeightsCommand, ProgressCommand, ResetCommand, SaveWeightsCommand, WeightsCommand } from "../models/audio-analyzer-commands.js";
import { type AudiosetManager } from "../models/audioset.js";

const { baseURI } = document;

//#region Audio analyser
export interface AudioAnalyzerEventMap {
	"progress": CustomEvent<number>;
}

export interface AudioAnalyzerOptions {
	isDeveloper: boolean;
	isDj: boolean;
}

export class AudioAnalyzer extends EventTarget {
	#isDeveloper: boolean;
	#isDj: boolean;
	#cell: BufferedCell<typeof NNWeights> = localStorage.openBufferedCell("Visualizer\\Studio\\NN weights\\1.1", NNWeights, new NNWeights());
	#bridge: FeatureBridge = new FeatureBridge();
	#sabMask: SharedArrayBuffer = StemMasks.createBuffer();
	#worker: Worker = new Worker(new URL("./controllers/audio-analyzer-worker.js", baseURI), { type: "module" });
	#workerMask: Worker = new Worker(new URL("./controllers/stem-mask-worker.js", baseURI), { type: "module" });
	#rate: number;
	#pendingExport: boolean = false;

	constructor(rate: number);
	constructor(rate: number, options: Partial<AudioAnalyzerOptions>);
	constructor(rate: number, options: Partial<AudioAnalyzerOptions> = {}) {
		super();

		this.#rate = rate;
		this.#isDeveloper = options.isDeveloper === true;
		this.#isDj = options.isDj === true;

		const { inSAB, outSAB } = this.#bridge;
		const worker = this.#worker;
		worker.postMessage(Command.export(new InitializeCommand(inSAB, outSAB)));
		worker.postMessage(Command.export(new AttachMasksCommand(this.#sabMask)));
		worker.addEventListener("message", this.#onMessage.bind(this));
		if (this.#isDj) void this.#loadWeights();
		void this.#loadCalibration();

		this.#workerMask.postMessage(Command.export(new InitializeCommand(inSAB, this.#sabMask)));
		void this.#loadMaskModel();
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
	get isDj(): boolean { return this.#isDj; }
	get outSAB(): SharedArrayBuffer { return this.#bridge.outSAB; }
	get sabMask(): SharedArrayBuffer { return this.#sabMask; }

	feedback(sign: number): void {
		if (!this.#isDeveloper) return;
		this.#worker.postMessage(Command.export(new FeedbackCommand(sign)));
	}

	set active(value: boolean) {
		if (!this.#isDj) return;
		this.#worker.postMessage(Command.export(new ActivityCommand(value)));
	}

	setLearning(enabled: boolean): void {
		if (!this.#isDeveloper) return;
		this.#worker.postMessage(Command.export(new LearningCommand(enabled)));
	}

	exportWeights(): void {
		if (!this.#isDeveloper) return;
		this.#pendingExport = true;
		this.#worker.postMessage(Command.export(new SaveWeightsCommand()));
	}

	resetWeights(): void {
		if (!this.#isDeveloper) return;
		this.#worker.postMessage(Command.export(new ResetCommand()));
		this.#cell.reset();
	}

	analyze(manager: AudiosetManager): void {
		const bridge = this.#bridge;
		manager.readFeatures(bridge.output);
		const { length, volume, amplitude, dataFrequency, dataTemporal, dataModel } = manager.audioset;
		bridge.writeInput(length, this.#rate, volume, amplitude, dataFrequency, dataTemporal, dataModel);
	}

	async #loadWeights(): Promise<void> {
		const worker = this.#worker;
		let weights = this.#cell.content;
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

	async #loadCalibration(): Promise<void> {
		const bridge = new ClientBridge();
		const content = await bridge.read(new URL("../data/calibration.json", baseURI));
		if (content === null) return;
		const calibration = Calibration.import(JSON.parse(content), "calibration");
		this.#worker.postMessage(Command.export(new LoadCalibrationCommand(calibration)));
	}

	async #loadMaskModel(): Promise<void> {
		const urlModel = new URL("../data/stem-mask/model.json", baseURI).toString();
		const urlWasm = new URL("../wasm/", baseURI).toString();
		this.#workerMask.postMessage(Command.export(new LoadMaskModelCommand(urlModel, urlWasm)));
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof WeightsCommand) {
			const cell = this.#cell;
			const cached = cell.content;
			const { weights } = command;
			cached.matrix1 = weights.matrix1;
			cached.bias1 = weights.bias1;
			cached.matrix2 = weights.matrix2;
			cached.bias2 = weights.bias2;
			cached.matrixV = weights.matrixV;
			cached.biasV = weights.biasV;
			cached.matrixW = weights.matrixW;
			cached.biasW = weights.biasW;
			void cell.save(2000);
			if (this.#pendingExport) {
				this.#pendingExport = false;
				this.#downloadFile("nn-weights.json", JSON.stringify(NNWeights.export(weights)));
			}
			return;
		}

		if (command instanceof ProgressCommand) {
			this.dispatchEvent(new CustomEvent("progress", { detail: command.count }));
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
