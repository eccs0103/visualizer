"use strict";

import "adaptive-extender/worker";
import { NNAgent } from "../models/nn-agent.js";
import { Command, ProgressCommand, WeightsCommand } from "../models/audio-analyzer-commands.js";

//#region Policy updater
export class PolicyUpdater {
	static #sizeBuffer: number = 64;
	static #updateInterval: number = 64;
	static #gamma: number = 0.95;
	static #saveInterval: number = 200;

	#features: Float32Array = new Float32Array(PolicyUpdater.#sizeBuffer * NNAgent.sizeInput);
	#controls: Float32Array = new Float32Array(PolicyUpdater.#sizeBuffer * NNAgent.sizeControl);
	#rewards: Float32Array = new Float32Array(PolicyUpdater.#sizeBuffer);
	#values: Float32Array = new Float32Array(PolicyUpdater.#sizeBuffer);
	#signs: Float32Array = new Float32Array(PolicyUpdater.#sizeBuffer);
	#gains: Float32Array = new Float32Array(PolicyUpdater.#sizeBuffer);
	#cursor: number = 0;
	#filled: number = 0;
	#updates: number = 0;
	#enabled: boolean = true;

	get enabled(): boolean { return this.#enabled; }
	set enabled(value: boolean) { this.#enabled = value; }

	consider(feature: Float32Array, control: Float32Array, value: number, reward: number, model: NNAgent, frameCount: number, sign: number, gain: number): void {
		const cursor = this.#cursor;
		const features = this.#features;
		const controls = this.#controls;
		const rewards = this.#rewards;
		const values = this.#values;
		const signs = this.#signs;
		const gains = this.#gains;
		const sizeBuffer = PolicyUpdater.#sizeBuffer;

		features.set(feature, cursor * NNAgent.sizeInput);
		controls.set(control, cursor * NNAgent.sizeControl);
		rewards[cursor] = reward;
		values[cursor] = value;
		signs[cursor] = sign;
		gains[cursor] = gain;
		this.#cursor = (cursor + 1) % sizeBuffer;
		let filled = this.#filled;
		if (filled < sizeBuffer) filled++;
		this.#filled = filled;

		if (!this.#enabled) return;
		if (frameCount % PolicyUpdater.#updateInterval !== 0) return;
		if (filled < sizeBuffer) return;

		const gamma = PolicyUpdater.#gamma;
		const sizeInput = NNAgent.sizeInput;
		const sizeControl = NNAgent.sizeControl;
		for (let index = 0; index < sizeBuffer; index++) {
			const next = (index + 1) % sizeBuffer;
			const input = features.subarray(index * sizeInput, index * sizeInput + sizeInput);
			const storedControl = controls.subarray(index * sizeControl, index * sizeControl + sizeControl);
			const tdTarget = rewards[index] + gamma * values[next];
			const sign = signs[index];
			const gain = gains[index];
			model.rlStep(input, storedControl, tdTarget, tdTarget - values[index], sign, gain);
		}

		this.#updates++;
		const updates = this.#updates;
		self.postMessage(Command.export(new ProgressCommand(updates)));
		if (updates % PolicyUpdater.#saveInterval === 0) {
			self.postMessage(Command.export(new WeightsCommand(model.getWeights())));
		}
	}

	flush(): void {
		this.#cursor = 0;
		this.#filled = 0;
	}

	reset(): void {
		this.#cursor = 0;
		this.#filled = 0;
		this.#updates = 0;
		self.postMessage(Command.export(new ProgressCommand(0)));
	}
}
//#endregion
