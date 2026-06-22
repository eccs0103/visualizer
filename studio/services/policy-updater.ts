"use strict";

import "adaptive-extender/worker";
import { NNAgent } from "../models/nn-agent.js";
import { Command, ProgressCommand, WeightsCommand } from "../models/audio-analyzer-commands.js";

//#region Policy updater
export class PolicyUpdater {
	static #bufferSize: number = 64;
	static #updateInterval: number = 64;
	static #gamma: number = 0.95;
	static #saveInterval: number = 200;

	#features: Float32Array = new Float32Array(PolicyUpdater.#bufferSize * NNAgent.sizeInput);
	#controls: Float32Array = new Float32Array(PolicyUpdater.#bufferSize * NNAgent.sizeControl);
	#rewards: Float32Array = new Float32Array(PolicyUpdater.#bufferSize);
	#values: Float32Array = new Float32Array(PolicyUpdater.#bufferSize);
	#feedbackSigns: Float32Array = new Float32Array(PolicyUpdater.#bufferSize);
	#feedbackGains: Float32Array = new Float32Array(PolicyUpdater.#bufferSize);
	#cursor: number = 0;
	#filled: number = 0;
	#updateCount: number = 0;
	#enabled: boolean = true;

	get enabled(): boolean { return this.#enabled; }
	set enabled(value: boolean) { this.#enabled = value; }

	consider(feature: Float32Array, control: Float32Array, value: number, reward: number, model: NNAgent, frameCount: number, feedbackSign: number, feedbackGain: number): void {
		const cursor = this.#cursor;
		const features = this.#features;
		const controls = this.#controls;
		const rewards = this.#rewards;
		const values = this.#values
		const feedbackSigns = this.#feedbackSigns
		const feedbackGains = this.#feedbackGains;
		const bufferSize = PolicyUpdater.#bufferSize;

		features.set(feature, cursor * NNAgent.sizeInput);
		controls.set(control, cursor * NNAgent.sizeControl);
		rewards[cursor] = reward;
		values[cursor] = value;
		feedbackSigns[cursor] = feedbackSign;
		feedbackGains[cursor] = feedbackGain;
		this.#cursor = (cursor + 1) % bufferSize;
		if (this.#filled < bufferSize) this.#filled++;

		if (!this.#enabled) return;
		if (frameCount % PolicyUpdater.#updateInterval !== 0) return;
		if (this.#filled < bufferSize) return;

		const gamma = PolicyUpdater.#gamma;
		const inputSize = NNAgent.sizeInput;
		const controlSize = NNAgent.sizeControl;
		for (let index = 0; index < bufferSize; index++) {
			const next = (index + 1) % bufferSize;
			const input = features.subarray(index * inputSize, index * inputSize + inputSize);
			const storedControl = controls.subarray(index * controlSize, index * controlSize + controlSize);
			const tdTarget = rewards[index] + gamma * values[next];
			const feedbackSign = feedbackSigns[index];
			const feedbackGain = feedbackGains[index];
			model.rlStep(input, storedControl, tdTarget, tdTarget - values[index], feedbackSign, feedbackGain);
		}

		this.#updateCount++;
		self.postMessage(Command.export(new ProgressCommand(this.#updateCount)));
		if (this.#updateCount % PolicyUpdater.#saveInterval === 0) {
			self.postMessage(Command.export(new WeightsCommand(model.getWeights())));
		}
	}

	reset(): void {
		this.#cursor = 0;
		this.#filled = 0;
		this.#updateCount = 0;
		self.postMessage(Command.export(new ProgressCommand(0)));
	}
}
//#endregion
