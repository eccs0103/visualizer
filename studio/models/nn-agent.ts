"use strict";

import "adaptive-extender/core";
import { Model, Field, ArrayOf, Random } from "adaptive-extender/core";
import { SceneDefinition } from "./audio-features.js";

const { sqrt, exp } = Math;
const random = Random.global;

//#region NN weights
export interface NNWeightsSceme {
	matrix_1: number[];
	bias_1: number[];
	matrix_2: number[];
	bias_2: number[];
	matrix_3: number[];
	bias_3: number[];
}

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
	static #sizeInput: number = 320;
	static #sizeHidden1: number = 64;
	static #sizeHidden2: number = 32;

	static #adamBeta1: number = 0.9;
	static #adamBeta2: number = 0.999;
	static #adamEpsilon: number = 1e-8;
	static #adamRate: number = 0.001;
	static #alpha: number = 0.02;

	#matrix1: Float32Array;
	#bias1: Float32Array;
	#matrix2: Float32Array;
	#bias2: Float32Array;
	#matrix3: Float32Array;
	#bias3: Float32Array;

	// Adam first moments
	#meanMatrix1: Float32Array;
	#meanBias1: Float32Array;
	#meanMatrix2: Float32Array;
	#meanBias2: Float32Array;
	#meanMatrix3: Float32Array;
	#meanBias3: Float32Array;

	// Adam second moments
	#varMatrix1: Float32Array;
	#varBias1: Float32Array;
	#varMatrix2: Float32Array;
	#varBias2: Float32Array;
	#varMatrix3: Float32Array;
	#varBias3: Float32Array;

	#stepCount: number = 0;

	#layer1: Float32Array = new Float32Array(NNAgent.#sizeHidden1);
	#layer2: Float32Array = new Float32Array(NNAgent.#sizeHidden2);
	#logits: Float32Array = new Float32Array(SceneDefinition.count);
	#probs: Float32Array = new Float32Array(SceneDefinition.count);

	// Pre-allocated backprop buffers
	#gradMatrix3: Float32Array;
	#gradBias3: Float32Array;
	#gradMatrix2: Float32Array;
	#gradBias2: Float32Array;
	#gradMatrix1: Float32Array;
	#gradBias1: Float32Array;
	#gradOutput: Float32Array;
	#gradNode2: Float32Array;
	#gradNode1: Float32Array;

	constructor() {
		const sizeHidden1 = NNAgent.#sizeHidden1, sizeHidden2 = NNAgent.#sizeHidden2;
		const sizeInput = NNAgent.#sizeInput, typeCount = SceneDefinition.count;

		this.#matrix1 = NNAgent.#newWeights(sizeHidden1 * sizeInput, sizeInput);
		this.#bias1 = new Float32Array(sizeHidden1);
		this.#matrix2 = NNAgent.#newWeights(sizeHidden2 * sizeHidden1, sizeHidden1);
		this.#bias2 = new Float32Array(sizeHidden2);
		this.#matrix3 = NNAgent.#newWeights(typeCount * sizeHidden2, sizeHidden2);
		this.#bias3 = new Float32Array(typeCount);

		this.#meanMatrix1 = new Float32Array(sizeHidden1 * sizeInput);
		this.#meanBias1 = new Float32Array(sizeHidden1);
		this.#meanMatrix2 = new Float32Array(sizeHidden2 * sizeHidden1);
		this.#meanBias2 = new Float32Array(sizeHidden2);
		this.#meanMatrix3 = new Float32Array(typeCount * sizeHidden2);
		this.#meanBias3 = new Float32Array(typeCount);

		this.#varMatrix1 = new Float32Array(sizeHidden1 * sizeInput);
		this.#varBias1 = new Float32Array(sizeHidden1);
		this.#varMatrix2 = new Float32Array(sizeHidden2 * sizeHidden1);
		this.#varBias2 = new Float32Array(sizeHidden2);
		this.#varMatrix3 = new Float32Array(typeCount * sizeHidden2);
		this.#varBias3 = new Float32Array(typeCount);

		this.#gradMatrix3 = new Float32Array(typeCount * sizeHidden2);
		this.#gradBias3 = new Float32Array(typeCount);
		this.#gradMatrix2 = new Float32Array(sizeHidden2 * sizeHidden1);
		this.#gradBias2 = new Float32Array(sizeHidden2);
		this.#gradMatrix1 = new Float32Array(sizeHidden1 * sizeInput);
		this.#gradBias1 = new Float32Array(sizeHidden1);
		this.#gradOutput = new Float32Array(typeCount);
		this.#gradNode2 = new Float32Array(sizeHidden2);
		this.#gradNode1 = new Float32Array(sizeHidden1);
	}

	static get sizeInput(): number { return NNAgent.#sizeInput; }

	static #newWeights(count: number, fanIn: number): Float32Array {
		const scale = sqrt(2 / fanIn);
		const weights = new Float32Array(count);
		for (let node = 0; node < count; node++) weights[node] = random.number(-scale, scale);
		return weights;
	}

	static #leaky(x: number): number {
		return x >= 0 ? x : NNAgent.#alpha * x;
	}

	static #slope(x: number): number {
		return x >= 0 ? 1 : NNAgent.#alpha;
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

	static #adamStep(param: Float32Array, grad: Float32Array, mean: Float32Array, variance: Float32Array, bias1Scale: number, bias2Scale: number): void {
		const beta1 = NNAgent.#adamBeta1, beta2 = NNAgent.#adamBeta2;
		const epsilon = NNAgent.#adamEpsilon, rate = NNAgent.#adamRate;
		for (let index = 0; index < param.length; index++) {
			const gradient = grad[index];
			mean[index] = beta1 * mean[index] + (1 - beta1) * gradient;
			variance[index] = beta2 * variance[index] + (1 - beta2) * gradient * gradient;
			param[index] -= rate * (mean[index] * bias1Scale) / (sqrt(variance[index] * bias2Scale) + epsilon);
		}
	}

	forward(input: Float32Array, out: Float32Array): void {
		const sizeHidden1 = NNAgent.#sizeHidden1, sizeHidden2 = NNAgent.#sizeHidden2;
		const sizeInput = NNAgent.#sizeInput, typeCount = SceneDefinition.count;
		const matrix1 = this.#matrix1, bias1 = this.#bias1;
		const matrix2 = this.#matrix2, bias2 = this.#bias2;
		const matrix3 = this.#matrix3, bias3 = this.#bias3;
		const layer1 = this.#layer1, layer2 = this.#layer2, logits = this.#logits;

		for (let node = 0; node < sizeHidden1; node++) {
			let sum = bias1[node];
			const row = node * sizeInput;
			for (let source = 0; source < sizeInput; source++) sum += matrix1[row + source] * input[source];
			layer1[node] = NNAgent.#leaky(sum);
		}
		for (let node = 0; node < sizeHidden2; node++) {
			let sum = bias2[node];
			const row = node * sizeHidden1;
			for (let source = 0; source < sizeHidden1; source++) sum += matrix2[row + source] * layer1[source];
			layer2[node] = NNAgent.#leaky(sum);
		}
		for (let scene = 0; scene < typeCount; scene++) {
			let sum = bias3[scene];
			const row = scene * sizeHidden2;
			for (let source = 0; source < sizeHidden2; source++) sum += matrix3[row + source] * layer2[source];
			logits[scene] = sum;
		}
		NNAgent.#softmax(logits, out);
	}

	trainStep(input: Float32Array, label: number): void {
		const sizeHidden1 = NNAgent.#sizeHidden1, sizeHidden2 = NNAgent.#sizeHidden2;
		const sizeInput = NNAgent.#sizeInput, typeCount = SceneDefinition.count;
		const matrix1 = this.#matrix1, bias1 = this.#bias1;
		const matrix2 = this.#matrix2, bias2 = this.#bias2;
		const matrix3 = this.#matrix3, bias3 = this.#bias3;
		const layer1 = this.#layer1, layer2 = this.#layer2;

		this.#stepCount++;
		const bias1Scale = 1 / (1 - NNAgent.#adamBeta1 ** this.#stepCount);
		const bias2Scale = 1 / (1 - NNAgent.#adamBeta2 ** this.#stepCount);

		this.forward(input, this.#probs);

		// Softmax + cross-entropy gradient: dL/dlogit_i = prob_i - 1{i==label}
		const gradOutput = this.#gradOutput;
		gradOutput.set(this.#probs);
		gradOutput[label] -= 1;

		// Layer 3 gradients
		const gradMatrix3 = this.#gradMatrix3, gradBias3 = this.#gradBias3;
		const gradNode2 = this.#gradNode2;
		gradMatrix3.fill(0);
		gradBias3.fill(0);
		gradNode2.fill(0);
		for (let scene = 0; scene < typeCount; scene++) {
			const gradient = gradOutput[scene];
			gradBias3[scene] = gradient;
			const row = scene * sizeHidden2;
			for (let source = 0; source < sizeHidden2; source++) {
				gradNode2[source] += matrix3[row + source] * gradient;
				gradMatrix3[row + source] = gradient * layer2[source];
			}
		}

		// Layer 2 gradients — LeakyReLU: output sign proxies pre-activation sign
		const gradMatrix2 = this.#gradMatrix2, gradBias2 = this.#gradBias2;
		const gradNode1 = this.#gradNode1;
		gradMatrix2.fill(0);
		gradBias2.fill(0);
		gradNode1.fill(0);
		for (let node = 0; node < sizeHidden2; node++) {
			const gradient = gradNode2[node] * NNAgent.#slope(layer2[node]);
			gradBias2[node] = gradient;
			const row = node * sizeHidden1;
			for (let source = 0; source < sizeHidden1; source++) {
				gradNode1[source] += matrix2[row + source] * gradient;
				gradMatrix2[row + source] = gradient * layer1[source];
			}
		}

		// Layer 1 gradients — LeakyReLU
		const gradMatrix1 = this.#gradMatrix1, gradBias1 = this.#gradBias1;
		gradMatrix1.fill(0);
		gradBias1.fill(0);
		for (let node = 0; node < sizeHidden1; node++) {
			const gradient = gradNode1[node] * NNAgent.#slope(layer1[node]);
			gradBias1[node] = gradient;
			const row = node * sizeInput;
			for (let source = 0; source < sizeInput; source++) gradMatrix1[row + source] = gradient * input[source];
		}

		// Adam weight updates (back-to-front to minimise moment cache thrashing)
		NNAgent.#adamStep(matrix3, gradMatrix3, this.#meanMatrix3, this.#varMatrix3, bias1Scale, bias2Scale);
		NNAgent.#adamStep(bias3, gradBias3, this.#meanBias3, this.#varBias3, bias1Scale, bias2Scale);
		NNAgent.#adamStep(matrix2, gradMatrix2, this.#meanMatrix2, this.#varMatrix2, bias1Scale, bias2Scale);
		NNAgent.#adamStep(bias2, gradBias2, this.#meanBias2, this.#varBias2, bias1Scale, bias2Scale);
		NNAgent.#adamStep(matrix1, gradMatrix1, this.#meanMatrix1, this.#varMatrix1, bias1Scale, bias2Scale);
		NNAgent.#adamStep(bias1, gradBias1, this.#meanBias1, this.#varBias1, bias1Scale, bias2Scale);
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

	reset(): void {
		const sizeHidden1 = NNAgent.#sizeHidden1, sizeHidden2 = NNAgent.#sizeHidden2;
		const sizeInput = NNAgent.#sizeInput, typeCount = SceneDefinition.count;
		this.#matrix1.set(NNAgent.#newWeights(sizeHidden1 * sizeInput, sizeInput));
		this.#matrix2.set(NNAgent.#newWeights(sizeHidden2 * sizeHidden1, sizeHidden1));
		this.#matrix3.set(NNAgent.#newWeights(typeCount * sizeHidden2, sizeHidden2));
		this.#bias1.fill(0);
		this.#bias2.fill(0);
		this.#bias3.fill(0);
		this.#zeroAdam();
	}

	loadWeights(weights: NNWeights): void {
		if (weights.matrix1.length !== this.#matrix1.length) return;
		this.#matrix1.set(weights.matrix1);
		this.#bias1.set(weights.bias1);
		this.#matrix2.set(weights.matrix2);
		this.#bias2.set(weights.bias2);
		this.#matrix3.set(weights.matrix3);
		this.#bias3.set(weights.bias3);
		this.#zeroAdam();
	}

	#zeroAdam(): void {
		this.#stepCount = 0;
		this.#meanMatrix1.fill(0); this.#meanBias1.fill(0);
		this.#meanMatrix2.fill(0); this.#meanBias2.fill(0);
		this.#meanMatrix3.fill(0); this.#meanBias3.fill(0);
		this.#varMatrix1.fill(0); this.#varBias1.fill(0);
		this.#varMatrix2.fill(0); this.#varBias2.fill(0);
		this.#varMatrix3.fill(0); this.#varBias3.fill(0);
	}
}
//#endregion
