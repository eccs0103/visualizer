"use strict";

import "adaptive-extender/worker";
import { NNAgent } from "../models/nn-agent.js";

//#region Auto teacher
export class AutoTeacher {
	static #confirmWindow = 4;
	static #trainInterval = 18;
	static #autoSaveInterval = 300;
	static #progressReportInterval = 50;

	#enabled: boolean = true;
	#sampleCount: number = 0;
	#confirmBuffer: number[] = [];

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

		model.trainStep(features, label, 0.004);
		this.#sampleCount++;

		if (this.#sampleCount % AutoTeacher.#progressReportInterval === 0) {
			self.postMessage({ type: "auto-progress", count: this.#sampleCount });
		}
		if (this.#sampleCount % AutoTeacher.#autoSaveInterval === 0) {
			self.postMessage({ type: "weights", weights: model.getWeights() });
		}
	}

	reset(): void {
		this.#sampleCount = 0;
		this.#confirmBuffer.length = 0;
		self.postMessage({ type: "auto-progress", count: 0 });
	}
}
//#endregion
