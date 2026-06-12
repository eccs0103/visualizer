"use strict";

import "adaptive-extender/worker";
import { NNAgent } from "../models/nn-agent.js";
import { SceneDefinition } from "../models/audio-features.js";
import { AutoProgressCommand, Command, WeightsCommand } from "../models/audio-analyzer-commands.js";

//#region Auto teacher
export class AutoTeacher {
	static #confirmWindow: number = 6;
	static #trainInterval: number = 12;
	static #autoSaveInterval: number = 200;
	static #progressReportInterval: number = 1;
	static #skipThreshold: number = 0.90;

	#enabled: boolean = true;
	#sampleCount: number = 0;
	#confirmBuffer: number[] = [];
	#tempProbs: Float32Array = new Float32Array(SceneDefinition.count);

	get enabled(): boolean { return this.#enabled; }
	set enabled(value: boolean) { this.#enabled = value; }
	get count(): number { return this.#sampleCount; }

	consider(label: number | null, features: Float32Array, model: NNAgent, frameCount: number): void {
		if (!this.#enabled || label === null) return;

		const confirmBuffer = this.#confirmBuffer;
		confirmBuffer.push(label);
		if (confirmBuffer.length > AutoTeacher.#confirmWindow) confirmBuffer.shift();

		const allAgree = confirmBuffer.length === AutoTeacher.#confirmWindow && confirmBuffer.every(candidate => candidate === label);
		if (!allAgree || frameCount % AutoTeacher.#trainInterval !== 0) return;

		model.forward(features, this.#tempProbs);
		if (this.#tempProbs[label] > AutoTeacher.#skipThreshold) return;

		model.trainStep(features, label);
		model.trainStep(features, label);
		this.#sampleCount++;

		if (this.#sampleCount % AutoTeacher.#progressReportInterval === 0) {
			self.postMessage(Command.export(new AutoProgressCommand(this.#sampleCount)));
		}

		if (this.#sampleCount % AutoTeacher.#autoSaveInterval === 0) {
			self.postMessage(Command.export(new WeightsCommand(model.getWeights())));
		}
	}

	reset(): void {
		this.#sampleCount = 0;
		this.#confirmBuffer.length = 0;
		self.postMessage(Command.export(new AutoProgressCommand(0)));
	}
}
//#endregion
