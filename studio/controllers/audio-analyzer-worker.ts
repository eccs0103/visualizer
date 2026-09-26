"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { SabLayout, StemMasks } from "../models/audio-features.js";
import { NNAgent } from "../models/nn-agent.js";
import { FrameProcessor } from "../services/frame-processor.js";
import { DjPilot } from "../services/dj-pilot.js";
import { PolicyUpdater } from "../services/policy-updater.js";
import { ActivityCommand, AttachMasksCommand, Command, FeedbackCommand, InitializeCommand, LearningCommand, LoadCalibrationCommand, LoadWeightsCommand, ResetCommand, SaveWeightsCommand, WeightsCommand } from "../models/audio-analyzer-commands.js";

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
	#pilot: DjPilot = new DjPilot();
	#masks: StemMasks | null = null;
	#threads: FrameProcessor[] = [new FrameProcessor(), new FrameProcessor(), new FrameProcessor(), new FrameProcessor()];
	#blocks: Float32Array[] = [];
	#silenced: boolean = false;

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

		if (!this.#processor.process(frame, length, inputMetadata, inputFrequency, inputTemporal, outputBuffer)) return;
		this.#analyzeThreads(frame, length, inputMetadata, inputFrequency, inputTemporal);

		const pilot = this.#pilot;
		if (pilot.active) {
			pilot.step(outputBuffer, this.#agent, this.#policy);
			this.#silenced = false;
			return;
		}
		if (this.#silenced) return;
		pilot.silence(outputBuffer);
		this.#silenced = true;
	}

	/** Runs the same analysis on each thread's spectrum (mix × mask) into its own block of outSAB — drums, bass, vocals, other. */
	#analyzeThreads(frame: number, length: number, metadata: Float32Array, frequency: Float32Array, temporal: Float32Array): void {
		const masks = this.#masks;
		if (masks === null) return;
		masks.invalidate();
		const whole = frequency.subarray(0, length);
		const spectra = [masks.drums(length, whole), masks.bass(length, whole), masks.vocals(length, whole), masks.other(length, whole)];
		const threads = this.#threads, blocks = this.#blocks;
		for (let stem = 0; stem < threads.length; stem++) threads[stem].process(frame, length, metadata, spectra[stem], temporal, blocks[stem]);
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");
		const processor = this.#processor;
		const pilot = this.#pilot;
		const agent = this.#agent;
		const policy = this.#policy;

		if (command instanceof InitializeCommand) {
			const { inSAB, outSAB } = command;
			this.#inputControl = new Int32Array(inSAB, 0, 2);
			this.#inputMetadata = new Float32Array(inSAB, 8, 3);
			this.#inputFrequency = new Float32Array(inSAB, 20, SabLayout.inputMaxLength);
			this.#inputTemporal = new Float32Array(inSAB, 20 + SabLayout.inputMaxLength * 4, SabLayout.inputMaxLength);
			const outputBuffer = this.#outputBuffer = new Float32Array(outSAB);
			this.#blocks = this.#threads.map((_, stem) => outputBuffer.subarray(SabLayout.stemOffset(stem), SabLayout.stemOffset(stem) + SabLayout.stemBlock));
			return;
		}

		if (command instanceof AttachMasksCommand) {
			this.#masks = new StemMasks(command.sabMask);
			return;
		}

		if (command instanceof LoadCalibrationCommand) {
			processor.loadCalibration(command.calibration);
			for (const thread of this.#threads) thread.loadCalibration(command.calibration);
			pilot.loadCalibration(command.calibration);
			return;
		}

		if (command instanceof FeedbackCommand) {
			pilot.injectFeedback(command.sign);
			return;
		}

		if (command instanceof LearningCommand) {
			policy.enabled = command.enabled;
			return;
		}

		if (command instanceof ActivityCommand) {
			pilot.active = command.enabled;
			policy.flush();
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
