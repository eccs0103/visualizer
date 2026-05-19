"use strict";

import "adaptive-extender/core";
import { Model, Field, ArrayOf, Random } from "adaptive-extender/core";
import { SceneDefinition } from "./audio-features.js";

const { sqrt, exp } = Math;
const random = Random.global;

//#region NN weights
export class NNWeights extends Model {
	@Field(ArrayOf(Number), "matrix_1")
	matrix1: number[] = [];

	@Field(ArrayOf(Number), "bias_1")
	bias1: number[] = [];

	@Field(ArrayOf(Number), "matrix_2")
	matrix2: number[] = [];

	@Field(ArrayOf(Number), "bias_2")
	bias2: number[] = [];

	@Field(ArrayOf(Number), "matrix_3")
	matrix3: number[] = [];

	@Field(ArrayOf(Number), "bias_3")
	bias3: number[] = [];
}
//#endregion

//#region NN agent
export class NNAgent {
	static #sizeInput: number = 18;
	static #sizeHidden1: number = 18;
	static #sizeHidden2: number = 9;

	static get sizeInput(): number { return NNAgent.#sizeInput; }

	#matrix1: Float32Array;
	#bias1: Float32Array;
	#matrix2: Float32Array;
	#bias2: Float32Array;
	#matrix3: Float32Array;
	#bias3: Float32Array;

	#layer1: Float32Array = new Float32Array(NNAgent.#sizeHidden1);
	#layer2: Float32Array = new Float32Array(NNAgent.#sizeHidden2);
	#logits: Float32Array = new Float32Array(SceneDefinition.count);

	constructor() {
		const sizeHidden1 = NNAgent.#sizeHidden1, sizeHidden2 = NNAgent.#sizeHidden2;
		const sizeInput = NNAgent.#sizeInput, sceneCount = SceneDefinition.count;
		this.#matrix1 = NNAgent.#newWeights(sizeHidden1 * sizeInput, sizeInput);
		this.#bias1 = new Float32Array(sizeHidden1);
		this.#matrix2 = NNAgent.#newWeights(sizeHidden2 * sizeHidden1, sizeHidden1);
		this.#bias2 = new Float32Array(sizeHidden2);
		this.#matrix3 = NNAgent.#newWeights(sceneCount * sizeHidden2, sizeHidden2);
		this.#bias3 = new Float32Array(sceneCount);
	}

	static #newWeights(count: number, fanIn: number): Float32Array {
		const scale = sqrt(2 / fanIn);
		const weights = new Float32Array(count);
		for (let node = 0; node < count; node++) weights[node] = random.number(-scale, scale);
		return weights;
	}

	static #relu(x: number): number {
		return x.clamp(0, Infinity);
	}

	static #softmax(logits: Float32Array, out: Float32Array): void {
		let max = -Infinity;
		for (let scene = 0; scene < logits.length; scene++) {
			if (logits[scene] > max) max = logits[scene];
		}
		let sum = 0;
		for (let scene = 0; scene < logits.length; scene++) {
			out[scene] = exp(logits[scene] - max);
			sum += out[scene];
		}
		for (let scene = 0; scene < out.length; scene++) out[scene] /= sum;
	}

	forward(input: Float32Array, out: Float32Array): void {
		const sizeHidden1 = NNAgent.#sizeHidden1, sizeHidden2 = NNAgent.#sizeHidden2;
		const sizeInput = NNAgent.#sizeInput, sceneCount = SceneDefinition.count;
		const matrix1 = this.#matrix1, bias1 = this.#bias1;
		const matrix2 = this.#matrix2, bias2 = this.#bias2;
		const matrix3 = this.#matrix3, bias3 = this.#bias3;
		const layer1 = this.#layer1, layer2 = this.#layer2, logits = this.#logits;

		for (let node = 0; node < sizeHidden1; node++) {
			let sum = bias1[node];
			const row = node * sizeInput;
			for (let source = 0; source < sizeInput; source++) sum += matrix1[row + source] * input[source];
			layer1[node] = NNAgent.#relu(sum);
		}
		for (let node = 0; node < sizeHidden2; node++) {
			let sum = bias2[node];
			const row = node * sizeHidden1;
			for (let source = 0; source < sizeHidden1; source++) sum += matrix2[row + source] * layer1[source];
			layer2[node] = NNAgent.#relu(sum);
		}
		for (let scene = 0; scene < sceneCount; scene++) {
			let sum = bias3[scene];
			const row = scene * sizeHidden2;
			for (let source = 0; source < sizeHidden2; source++) sum += matrix3[row + source] * layer2[source];
			logits[scene] = sum;
		}
		NNAgent.#softmax(logits, out);
	}

	trainStep(input: Float32Array, label: number, learningRate: number): void {
		const sizeHidden1 = NNAgent.#sizeHidden1, sizeHidden2 = NNAgent.#sizeHidden2;
		const sizeInput = NNAgent.#sizeInput, sceneCount = SceneDefinition.count;
		const matrix1 = this.#matrix1, bias1 = this.#bias1;
		const matrix2 = this.#matrix2, bias2 = this.#bias2;
		const matrix3 = this.#matrix3, bias3 = this.#bias3;
		const layer1 = this.#layer1, layer2 = this.#layer2;

		const probs = new Float32Array(sceneCount);
		this.forward(input, probs);

		const outGradients = new Float32Array(probs);
		outGradients[label] -= 1;

		const node2Gradients = new Float32Array(sizeHidden2);
		for (let scene = 0; scene < sceneCount; scene++) {
			const gradient = outGradients[scene];
			bias3[scene] -= learningRate * gradient;
			const row = scene * sizeHidden2;
			for (let source = 0; source < sizeHidden2; source++) {
				node2Gradients[source] += matrix3[row + source] * gradient;
				matrix3[row + source] -= learningRate * gradient * layer2[source];
			}
		}
		for (let source = 0; source < sizeHidden2; source++) if (layer2[source] <= 0) node2Gradients[source] = 0;

		const node1Gradients = new Float32Array(sizeHidden1);
		for (let node = 0; node < sizeHidden2; node++) {
			const gradient = node2Gradients[node];
			bias2[node] -= learningRate * gradient;
			const row = node * sizeHidden1;
			for (let source = 0; source < sizeHidden1; source++) {
				node1Gradients[source] += matrix2[row + source] * gradient;
				matrix2[row + source] -= learningRate * gradient * layer1[source];
			}
		}
		for (let source = 0; source < sizeHidden1; source++) if (layer1[source] <= 0) node1Gradients[source] = 0;

		for (let node = 0; node < sizeHidden1; node++) {
			const gradient = node1Gradients[node];
			bias1[node] -= learningRate * gradient;
			const row = node * sizeInput;
			for (let source = 0; source < sizeInput; source++) matrix1[row + source] -= learningRate * gradient * input[source];
		}
	}

	getWeights(): NNWeights {
		const weights = new NNWeights();
		weights.matrix1 = Array.from(this.#matrix1);
		weights.bias1 = Array.from(this.#bias1);
		weights.matrix2 = Array.from(this.#matrix2);
		weights.bias2 = Array.from(this.#bias2);
		weights.matrix3 = Array.from(this.#matrix3);
		weights.bias3 = Array.from(this.#bias3);
		return weights;
	}

	loadWeights(weights: NNWeights): void {
		if (weights.matrix1.length !== this.#matrix1.length) return;
		this.#matrix1.set(weights.matrix1);
		this.#bias1.set(weights.bias1);
		this.#matrix2.set(weights.matrix2);
		this.#bias2.set(weights.bias2);
		this.#matrix3.set(weights.matrix3);
		this.#bias3.set(weights.bias3);
	}
}
//#endregion
