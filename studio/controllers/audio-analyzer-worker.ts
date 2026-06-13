"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { SabLayout } from "../models/audio-features.js";
import { NNAgent } from "../models/nn-agent.js";
import { FrameProcessor } from "../services/frame-processor.js";
import { PolicyUpdater } from "../services/policy-updater.js";
import { Command, FeedbackCommand, InitializeCommand, LearningCommand, LoadWeightsCommand, ResetCommand, SaveWeightsCommand, WeightsCommand } from "../models/audio-analyzer-commands.js";

//#region Audio analyzer worker
class AudioAnalyzerWorker extends Controller {
	#inputControl: Int32Array | null = null;
	#inputMetadata: Float32Array | null = null;
	#inputFrequency: Float32Array | null = null;
	#inputTemporal: Float32Array | null = null;
	#outputBuffer: Float32Array | null = null;

	#agent: NNAgent = new NNAgent();
	#processor: FrameProcessor = new FrameProcessor();
	#policy: PolicyUpdater = new PolicyUpdater();

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
		const policy = this.#policy;
		processor.process(frame, length, inputMetadata, inputFrequency, inputTemporal, outputBuffer, agent, policy);
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");
		const processor = this.#processor;
		const agent = this.#agent;
		const policy = this.#policy;

		if (command instanceof InitializeCommand) {
			const { inSAB, outSAB } = command;
			this.#inputControl = new Int32Array(inSAB, 0, 2);
			this.#inputMetadata = new Float32Array(inSAB, 8, 3);
			this.#inputFrequency = new Float32Array(inSAB, 20, SabLayout.inputMaxLength);
			this.#inputTemporal = new Float32Array(inSAB, 20 + SabLayout.inputMaxLength * 4, SabLayout.inputMaxLength);
			this.#outputBuffer = new Float32Array(outSAB);
			return;
		}

		if (command instanceof FeedbackCommand) {
			processor.injectFeedback(command.sign);
			return;
		}

		if (command instanceof LearningCommand) {
			policy.enabled = command.enabled;
			return;
		}

		if (command instanceof ResetCommand) {
			agent.reset();
			policy.reset();
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
