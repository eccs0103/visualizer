"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { SabLayout } from "../models/audio-features.js";
import { NNAgent } from "../models/nn-agent.js";
import { FrameProcessor } from "../services/frame-processor.js";
import { AutoTeacher } from "../services/auto-teacher.js";
import { Command, InitializeCommand, LoadWeightsCommand, ResetCommand, SaveWeightsCommand, SetAutoTrainCommand, TrainCommand, WeightsCommand } from "../models/audio-analyzer-commands.js";

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
		if (pendingLabel === null) return;
		agent.trainStep(processor.lastInputFeatures, pendingLabel);
		this.#pendingLabel = null;
		if (processor.frameCount % 300 === 0) self.postMessage(Command.export(new WeightsCommand(agent.getWeights())));
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");
		const teacher = this.#teacher;
		const agent = this.#agent;

		if (command instanceof InitializeCommand) {
			const { inSAB, outSAB } = command;
			this.#inputControl = new Int32Array(inSAB, 0, 2);
			this.#inputMetadata = new Float32Array(inSAB, 8, 3);
			this.#inputFrequency = new Float32Array(inSAB, 20, SabLayout.inputMaxLength);
			this.#inputTemporal = new Float32Array(inSAB, 20 + SabLayout.inputMaxLength * 4, SabLayout.inputMaxLength);
			this.#outputBuffer = new Float32Array(outSAB);
			return;
		}

		if (command instanceof SetAutoTrainCommand) {
			teacher.enabled = command.enabled;
			return;
		}

		if (command instanceof ResetCommand) {
			agent.reset();
			teacher.reset();
			return;
		}

		if (command instanceof TrainCommand) {
			this.#pendingLabel = command.label;
			return;
		}

		if (command instanceof LoadWeightsCommand) {
			agent.loadWeights(command.weights);
			return;
		}

		if (command instanceof SaveWeightsCommand) {
			self.postMessage(Command.export(new WeightsCommand(agent.getWeights())));
		}
	}

	async run(): Promise<void> {
		setInterval(this.#poll.bind(this), 4);
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await AudioAnalyzerWorker.launch();
