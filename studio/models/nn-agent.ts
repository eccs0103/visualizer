"use strict";

import "adaptive-extender/core";
import { Model, Field, Random } from "adaptive-extender/core";

const { sqrt, abs, tanh } = Math;
const random = Random.global;

//#region NN weights
export interface NNWeightsScheme {
	matrix_1: number[];
	bias_1: number[];
	matrix_2: number[];
	bias_2: number[];
	matrix_v: number[];
	bias_v: number[];
	matrix_w: number[];
	bias_w: number[];
}

export class NNWeights extends Model {
	@Field(Array.Of(Number), { name: "matrix_1" })
	matrix1: number[] = [];

	@Field(Array.Of(Number), { name: "bias_1" })
	bias1: number[] = [];

	@Field(Array.Of(Number), { name: "matrix_2" })
	matrix2: number[] = [];

	@Field(Array.Of(Number), { name: "bias_2" })
	bias2: number[] = [];

	@Field(Array.Of(Number), { name: "matrix_v" })
	matrixV: number[] = [];

	@Field(Array.Of(Number), { name: "bias_v" })
	biasV: number[] = [];

	@Field(Array.Of(Number), { name: "matrix_w" })
	matrixW: number[] = [];

	@Field(Array.Of(Number), { name: "bias_w" })
	biasW: number[] = [];
}
//#endregion
//#region NN agent
export class NNAgent {
	static #sizeInput: number = 320;
	static #sizeHidden1: number = 64;
	static #sizeHidden2: number = 32;
	static #sizeControl: number = 5;

	static #adamBeta1: number = 0.9;
	static #adamBeta2: number = 0.999;
	static #adamEpsilon: number = 1e-8;
	static #adamRate: number = 0.001;
	static #alpha: number = 0.02;

	#matrix1: Float32Array;
	#bias1: Float32Array;
	#matrix2: Float32Array;
	#bias2: Float32Array;

	// Control head (sizeControl × sizeHidden2) — tanh activation, bipolar outputs
	#matrixV: Float32Array;
	#biasV: Float32Array;
	// Value head (1 × sizeHidden2)
	#matrixW: Float32Array;
	#biasW: Float32Array;

	// Adam first moments
	#meanMatrix1: Float32Array;
	#meanBias1: Float32Array;
	#meanMatrix2: Float32Array;
	#meanBias2: Float32Array;
	#meanMatrixV: Float32Array;
	#meanBiasV: Float32Array;
	#meanMatrixW: Float32Array;
	#meanBiasW: Float32Array;

	// Adam second moments
	#varMatrix1: Float32Array;
	#varBias1: Float32Array;
	#varMatrix2: Float32Array;
	#varBias2: Float32Array;
	#varMatrixV: Float32Array;
	#varBiasV: Float32Array;
	#varMatrixW: Float32Array;
	#varBiasW: Float32Array;

	#rlStepCount: number = 0;

	#layer1: Float32Array = new Float32Array(NNAgent.#sizeHidden1);
	#layer2: Float32Array = new Float32Array(NNAgent.#sizeHidden2);

	// Pre-allocated backprop buffers (RL heads)
	#gradMatrixV: Float32Array;
	#gradBiasV: Float32Array;
	#gradMatrixW: Float32Array;
	#gradBiasW: Float32Array;

	constructor() {
		const sizeHidden1 = NNAgent.#sizeHidden1, sizeHidden2 = NNAgent.#sizeHidden2;
		const sizeInput = NNAgent.#sizeInput, sizeControl = NNAgent.#sizeControl;

		this.#matrix1 = NNAgent.#newWeights(sizeHidden1 * sizeInput, sizeInput);
		this.#bias1 = new Float32Array(sizeHidden1);
		this.#matrix2 = NNAgent.#newWeights(sizeHidden2 * sizeHidden1, sizeHidden1);
		this.#bias2 = new Float32Array(sizeHidden2);
		this.#matrixV = NNAgent.#newWeights(sizeControl * sizeHidden2, sizeHidden2);
		this.#biasV = new Float32Array(sizeControl);
		this.#matrixW = NNAgent.#newWeights(sizeHidden2, sizeHidden2);
		this.#biasW = new Float32Array(1);

		this.#meanMatrix1 = new Float32Array(sizeHidden1 * sizeInput);
		this.#meanBias1 = new Float32Array(sizeHidden1);
		this.#meanMatrix2 = new Float32Array(sizeHidden2 * sizeHidden1);
		this.#meanBias2 = new Float32Array(sizeHidden2);
		this.#meanMatrixV = new Float32Array(sizeControl * sizeHidden2);
		this.#meanBiasV = new Float32Array(sizeControl);
		this.#meanMatrixW = new Float32Array(sizeHidden2);
		this.#meanBiasW = new Float32Array(1);

		this.#varMatrix1 = new Float32Array(sizeHidden1 * sizeInput);
		this.#varBias1 = new Float32Array(sizeHidden1);
		this.#varMatrix2 = new Float32Array(sizeHidden2 * sizeHidden1);
		this.#varBias2 = new Float32Array(sizeHidden2);
		this.#varMatrixV = new Float32Array(sizeControl * sizeHidden2);
		this.#varBiasV = new Float32Array(sizeControl);
		this.#varMatrixW = new Float32Array(sizeHidden2);
		this.#varBiasW = new Float32Array(1);

		this.#gradMatrixV = new Float32Array(sizeControl * sizeHidden2);
		this.#gradBiasV = new Float32Array(sizeControl);
		this.#gradMatrixW = new Float32Array(sizeHidden2);
		this.#gradBiasW = new Float32Array(1);
	}

	static get sizeInput(): number { return NNAgent.#sizeInput; }
	static get sizeControl(): number { return NNAgent.#sizeControl; }

	static #newWeights(count: number, fanIn: number): Float32Array {
		const scale = sqrt(2 / fanIn);
		const weights = new Float32Array(count);
		for (let node = 0; node < count; node++) weights[node] = random.number(-scale, scale);
		return weights;
	}

	static #leaky(x: number): number {
		return x >= 0 ? x : NNAgent.#alpha * x;
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

	#forward(input: Float32Array): void {
		const sizeHidden1 = NNAgent.#sizeHidden1, sizeHidden2 = NNAgent.#sizeHidden2;
		const sizeInput = NNAgent.#sizeInput;
		const matrix1 = this.#matrix1, bias1 = this.#bias1;
		const matrix2 = this.#matrix2, bias2 = this.#bias2;
		const layer1 = this.#layer1, layer2 = this.#layer2;

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
	}

	forwardControl(input: Float32Array, controlOut: Float32Array, valueOut: Float32Array): void {
		const sizeHidden2 = NNAgent.#sizeHidden2, sizeControl = NNAgent.#sizeControl;
		const matrixV = this.#matrixV, biasV = this.#biasV;
		const matrixW = this.#matrixW, biasW = this.#biasW;
		const layer2 = this.#layer2;

		this.#forward(input);

		for (let param = 0; param < sizeControl; param++) {
			let sum = biasV[param];
			const row = param * sizeHidden2;
			for (let source = 0; source < sizeHidden2; source++) sum += matrixV[row + source] * layer2[source];
			controlOut[param] = tanh(sum);
		}
		let valueSum = biasW[0];
		for (let source = 0; source < sizeHidden2; source++) valueSum += matrixW[source] * layer2[source];
		valueOut[0] = valueSum;
	}

	// RL step: updates control head and value head.
	// storedControl: the control output recorded at the time this experience was collected.
	// When advantage > 0 (good action): push control head toward storedControl (reinforce).
	// When advantage ≤ 0 (bad action): push control head toward 0 (neutralize — return to default).
	rlStep(input: Float32Array, storedControl: Float32Array, tdTarget: number, advantage: number): void {
		const sizeHidden2 = NNAgent.#sizeHidden2, sizeControl = NNAgent.#sizeControl;
		const matrixV = this.#matrixV, biasV = this.#biasV;
		const matrixW = this.#matrixW, biasW = this.#biasW;
		const layer2 = this.#layer2;

		this.#rlStepCount++;
		const b1 = 1 / (1 - NNAgent.#adamBeta1 ** this.#rlStepCount);
		const b2 = 1 / (1 - NNAgent.#adamBeta2 ** this.#rlStepCount);

		this.#forward(input);

		const weight = abs(advantage);
		const isPositive = advantage > 0;
		if (weight > 0.001) {
			const gradMatrixV = this.#gradMatrixV, gradBiasV = this.#gradBiasV;
			gradMatrixV.fill(0);
			gradBiasV.fill(0);
			for (let param = 0; param < sizeControl; param++) {
				let sum = biasV[param];
				const row = param * sizeHidden2;
				for (let source = 0; source < sizeHidden2; source++) sum += matrixV[row + source] * layer2[source];
				const output = tanh(sum);
				const target = isPositive ? storedControl[param] : 0;
				const grad = weight * (output - target) * (1 - output * output);
				gradBiasV[param] = grad;
				for (let source = 0; source < sizeHidden2; source++) gradMatrixV[row + source] = grad * layer2[source];
			}
			NNAgent.#adamStep(matrixV, gradMatrixV, this.#meanMatrixV, this.#varMatrixV, b1, b2);
			NNAgent.#adamStep(biasV, gradBiasV, this.#meanBiasV, this.#varBiasV, b1, b2);
		}

		const gradMatrixW = this.#gradMatrixW, gradBiasW = this.#gradBiasW;
		let valueSum = biasW[0];
		for (let source = 0; source < sizeHidden2; source++) valueSum += matrixW[source] * layer2[source];
		const valueGrad = 2 * (valueSum - tdTarget);
		gradBiasW[0] = valueGrad;
		for (let source = 0; source < sizeHidden2; source++) gradMatrixW[source] = valueGrad * layer2[source];
		NNAgent.#adamStep(matrixW, gradMatrixW, this.#meanMatrixW, this.#varMatrixW, b1, b2);
		NNAgent.#adamStep(biasW, gradBiasW, this.#meanBiasW, this.#varBiasW, b1, b2);
	}

	getWeights(): NNWeights {
		const weights = new NNWeights();
		weights.matrix1 = Array.from(this.#matrix1);
		weights.bias1 = Array.from(this.#bias1);
		weights.matrix2 = Array.from(this.#matrix2);
		weights.bias2 = Array.from(this.#bias2);
		weights.matrixV = Array.from(this.#matrixV);
		weights.biasV = Array.from(this.#biasV);
		weights.matrixW = Array.from(this.#matrixW);
		weights.biasW = Array.from(this.#biasW);
		return weights;
	}

	reset(): void {
		const sizeHidden1 = NNAgent.#sizeHidden1, sizeHidden2 = NNAgent.#sizeHidden2;
		const sizeInput = NNAgent.#sizeInput, sizeControl = NNAgent.#sizeControl;
		this.#matrix1.set(NNAgent.#newWeights(sizeHidden1 * sizeInput, sizeInput));
		this.#matrix2.set(NNAgent.#newWeights(sizeHidden2 * sizeHidden1, sizeHidden1));
		this.#matrixV.set(NNAgent.#newWeights(sizeControl * sizeHidden2, sizeHidden2));
		this.#matrixW.set(NNAgent.#newWeights(sizeHidden2, sizeHidden2));
		this.#bias1.fill(0); this.#bias2.fill(0);
		this.#biasV.fill(0); this.#biasW.fill(0);
		this.#zeroAdam();
	}

	loadWeights(weights: NNWeights): void {
		if (weights.matrix1.length !== this.#matrix1.length) return;
		this.#matrix1.set(weights.matrix1);
		this.#bias1.set(weights.bias1);
		this.#matrix2.set(weights.matrix2);
		this.#bias2.set(weights.bias2);
		if (weights.matrixV.length === this.#matrixV.length) {
			this.#matrixV.set(weights.matrixV);
			this.#biasV.set(weights.biasV);
			this.#matrixW.set(weights.matrixW);
			this.#biasW.set(weights.biasW);
		}
		this.#zeroAdam();
	}

	#zeroAdam(): void {
		this.#rlStepCount = 0;
		this.#meanMatrix1.fill(0); this.#meanBias1.fill(0);
		this.#meanMatrix2.fill(0); this.#meanBias2.fill(0);
		this.#meanMatrixV.fill(0); this.#meanBiasV.fill(0);
		this.#meanMatrixW.fill(0); this.#meanBiasW.fill(0);
		this.#varMatrix1.fill(0); this.#varBias1.fill(0);
		this.#varMatrix2.fill(0); this.#varBias2.fill(0);
		this.#varMatrixV.fill(0); this.#varBiasV.fill(0);
		this.#varMatrixW.fill(0); this.#varBiasW.fill(0);
	}
}
//#endregion
