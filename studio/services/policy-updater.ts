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
	#cursor: number = 0;
	#filled: number = 0;
	#updateCount: number = 0;
	#enabled: boolean = true;

	get enabled(): boolean { return this.#enabled; }
	set enabled(value: boolean) { this.#enabled = value; }

	consider(features: Float32Array, control: Float32Array, value: number, reward: number, model: NNAgent, frameCount: number): void {
		const cursor = this.#cursor;
		this.#features.set(features, cursor * NNAgent.sizeInput);
		this.#controls.set(control, cursor * NNAgent.sizeControl);
		this.#rewards[cursor] = reward;
		this.#values[cursor] = value;
		this.#cursor = (cursor + 1) % PolicyUpdater.#bufferSize;
		if (this.#filled < PolicyUpdater.#bufferSize) this.#filled++;

		if (!this.#enabled) return;
		if (frameCount % PolicyUpdater.#updateInterval !== 0) return;
		if (this.#filled < PolicyUpdater.#bufferSize) return;

		const bufferSize = PolicyUpdater.#bufferSize;
		const gamma = PolicyUpdater.#gamma;
		const inputSize = NNAgent.sizeInput;
		const controlSize = NNAgent.sizeControl;
		for (let index = 0; index < bufferSize; index++) {
			const next = (index + 1) % bufferSize;
			const tdTarget = this.#rewards[index] + gamma * this.#values[next];
			model.rlStep(
				this.#features.subarray(index * inputSize, index * inputSize + inputSize),
				this.#controls.subarray(index * controlSize, index * controlSize + controlSize),
				tdTarget,
				tdTarget - this.#values[index]
			);
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
