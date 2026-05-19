"use strict";

import "adaptive-extender/core";
import { Controller } from "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";
import { NNAgent, NNWeights } from "../models/nn-agent.js";
import { FrameProcessor } from "../services/frame-processor.js";
import { AutoTeacher } from "../services/auto-teacher.js";

//#region Audio analyzer worker
class AudioAnalyzerWorker extends Controller {
	#inputControl: Int32Array | null = null;
	#inputMetadata: Float32Array | null = null;
	#inputFrequency: Float32Array | null = null;
	#inputTemporal: Float32Array | null = null;
	#outputBuffer: Float32Array | null = null;

	#agent: NNAgent = new NNAgent();
	#processor: FrameProcessor = new FrameProcessor();
	#teacher: AutoTeacher = new AutoTeacher();
	#pendingLabel: number | null = null;

	#poll(): void {
		const inputControl = this.#inputControl;
		const inputMetadata = this.#inputMetadata;
		const inputFrequency = this.#inputFrequency;
		const inputTemporal = this.#inputTemporal;
		const outputBuffer = this.#outputBuffer;
		if (inputControl === null || inputMetadata === null || inputFrequency === null || inputTemporal === null || outputBuffer === null) return;

		const frame = Atomics.load(inputControl, 0);
		const length = Atomics.load(inputControl, 1);
		if (1 > length || length > SabLayout.inputMaxLength) return;

		const agent = this.#agent;
		const processor = this.#processor;
		const teacher = this.#teacher;
		processor.process(frame, length, inputMetadata, inputFrequency, inputTemporal, outputBuffer, agent, teacher);

		const pendingLabel = this.#pendingLabel;
		if (pendingLabel !== null) {
			agent.trainStep(processor.lastInputFeatures, pendingLabel, 0.01);
			this.#pendingLabel = null;
			if (processor.frameCount % 300 === 0) self.postMessage({ type: "weights", weights: agent.getWeights() });
		}
	}

	#onMessage(event: MessageEvent): void {
		const data = event.data as { type: string; [key: string]: unknown; };
		const teacher = this.#teacher;
		const agent = this.#agent;

		if (data.type === "init") {
			const inputSAB = data.inSAB as SharedArrayBuffer;
			const outputSAB = data.outSAB as SharedArrayBuffer;
			this.#inputControl = new Int32Array(inputSAB, 0, 2);
			this.#inputMetadata = new Float32Array(inputSAB, 8, 3);
			this.#inputFrequency = new Float32Array(inputSAB, 20, SabLayout.inputMaxLength);
			this.#inputTemporal = new Float32Array(inputSAB, 20 + SabLayout.inputMaxLength * 4, SabLayout.inputMaxLength);
			this.#outputBuffer = new Float32Array(outputSAB);
			return;
		}

		if (data.type === "set-auto-train") {
			teacher.enabled = data.enabled as boolean;
			return;
		}

		if (data.type === "reset") {
			teacher.reset();
			return;
		}

		if (data.type === "train") {
			this.#pendingLabel = data.label as number;
			return;
		}

		if (data.type === "load-weights") {
			agent.loadWeights(data.weights as NNWeights);
			return;
		}

		if (data.type === "save-weights") {
			self.postMessage({ type: "weights", weights: agent.getWeights() });
		}
	}

	async run(): Promise<void> {
		setInterval(this.#poll.bind(this), 4);
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await AudioAnalyzerWorker.launch();
