"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { SabLayout, Signal, StemMasks } from "../models/audio-features.js";
import { FrameProcessor } from "../services/frame-processor.js";
import { Command, InitializeAnalyzerCommand, TickCommand } from "../models/commands.js";

//#region Audio analyzer worker
class AudioAnalyzerWorker extends Controller {
	#signal: Signal | null = null;
	#features: Float32Array = new Float32Array(0);
	#masks: StemMasks | null = null;
	#sampleRate: number = 0;
	#processors: FrameProcessor[] = [new FrameProcessor(), new FrameProcessor(), new FrameProcessor(), new FrameProcessor(), new FrameProcessor()];

	#analyze(signal: Signal, masks: StemMasks): void {
		const { length, time, frequency } = signal;
		if (1 > length || length > SabLayout.maxLength) return;
		masks.invalidate();
		const whole = frequency.subarray(0, length);
		const spectra = [whole, masks.drums(length, whole), masks.bass(length, whole), masks.vocals(length, whole), masks.other(length, whole)];
		const processors = this.#processors, features = this.#features, sampleRate = this.#sampleRate;
		const block = SabLayout.block;
		for (let index = 0; index < processors.length; index++) processors[index].process(length, sampleRate, time, spectra[index], features.subarray(index * block, (index + 1) * block));
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof InitializeAnalyzerCommand) {
			this.#signal = new Signal(command.sabSignal);
			this.#features = new Float32Array(command.sabFeatures);
			this.#masks = new StemMasks(command.sabMask);
			this.#sampleRate = command.sampleRate;
			return;
		}

		if (command instanceof TickCommand) {
			const signal = this.#signal, masks = this.#masks;
			if (signal === null || masks === null) return;
			this.#analyze(signal, masks);
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await AudioAnalyzerWorker.launch();
