"use strict";

import "adaptive-extender/worker";
import { NNAgent, NNWeights } from "../models/nn-agent.js";
import { SceneDefinition } from "../models/audio-features.js";

//#region Auto teacher
export class AutoTeacher {
	static #confirmWindow = 6;
	static #trainInterval = 12;
	static #autoSaveInterval = 200;
	static #progressReportInterval = 50;
	static #skipThreshold = 0.90;

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

		// Skip if model is already confident about this label — no gradient to apply
		model.forward(features, this.#tempProbs);
		if (this.#tempProbs[label] > AutoTeacher.#skipThreshold) return;

		model.trainStep(features, label);
		model.trainStep(features, label);
		this.#sampleCount++;

		if (this.#sampleCount % AutoTeacher.#progressReportInterval === 0) {
			self.postMessage({ type: "auto-progress", count: this.#sampleCount });
		}
		if (this.#sampleCount % AutoTeacher.#autoSaveInterval === 0) {
			self.postMessage({ type: "weights", weights: NNWeights.export(model.getWeights()) });
		}
	}

	reset(): void {
		this.#sampleCount = 0;
		this.#confirmBuffer.length = 0;
		self.postMessage({ type: "auto-progress", count: 0 });
	}
}
//#endregion
