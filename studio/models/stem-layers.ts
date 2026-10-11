"use strict";

import "adaptive-extender/core";
import { type StemTensor, type StemTensors } from "./stem-weights.js";

const { sqrt } = Math;

//#region Convolution layer
export class ConvolutionLayer {
	static #epsilon: number = 1e-3;

	#kernel: StemTensor;
	#bias: StemTensor;
	#gamma: StemTensor;
	#beta: StemTensor;
	#mean: StemTensor;
	#variance: StemTensor;

	constructor(kernel: StemTensor, bias: StemTensor, gamma: StemTensor, beta: StemTensor, mean: StemTensor, variance: StemTensor) {
		this.#kernel = kernel;
		this.#bias = bias;
		this.#gamma = gamma;
		this.#beta = beta;
		this.#mean = mean;
		this.#variance = variance;
	}

	static read(tensors: StemTensors, number: number): ConvolutionLayer {
		const convolution = `conv1d_Conv1D${number}`;
		const norm = `batch_normalization_BatchNormalization${number}`;
		return new ConvolutionLayer(tensors.take(`${convolution}/kernel`), tensors.take(`${convolution}/bias`), tensors.take(`${norm}/gamma`), tensors.take(`${norm}/beta`), tensors.take(`${norm}/moving_mean`), tensors.take(`${norm}/moving_variance`));
	}

	get size(): number { return this.#kernel.shape[0]; }
	get channels(): number { return this.#kernel.shape[1]; }
	get filters(): number { return this.#kernel.shape[2]; }

	pack(channels: number): Float32Array<ArrayBuffer> {
		const { size, filters } = this;
		const count = size * channels * filters;
		const weights = new Float32Array(count + filters * 3);
		weights.set(this.#kernel.expect(size, channels, filters));
		weights.set(this.#bias.expect(filters), count);
		const gamma = this.#gamma.expect(filters);
		const beta = this.#beta.expect(filters);
		const mean = this.#mean.expect(filters);
		const variance = this.#variance.expect(filters);
		for (let unit = 0; unit < filters; unit++) {
			const scale = gamma[unit] / sqrt(variance[unit] + ConvolutionLayer.#epsilon);
			weights[count + filters + unit] = scale;
			weights[count + filters * 2 + unit] = beta[unit] - mean[unit] * scale;
		}
		return weights;
	}
}
//#endregion
//#region Head layer
export class HeadLayer {
	#kernel: StemTensor;
	#bias: StemTensor;

	constructor(kernel: StemTensor, bias: StemTensor) {
		this.#kernel = kernel;
		this.#bias = bias;
	}

	static read(tensors: StemTensors, number: number): HeadLayer {
		const convolution = `conv1d_Conv1D${number}`;
		return new HeadLayer(tensors.take(`${convolution}/kernel`), tensors.take(`${convolution}/bias`));
	}

	get stems(): number { return this.#kernel.shape[2]; }

	pack(channels: number): Float32Array<ArrayBuffer> {
		const { stems } = this;
		const weights = new Float32Array(channels * stems + stems);
		weights.set(this.#kernel.expect(1, channels, stems));
		weights.set(this.#bias.expect(stems), channels * stems);
		return weights;
	}
}
//#endregion
//#region Presence layer
export class PresenceLayer {
	static #name: string = "dense_Dense1";

	#kernel: StemTensor;
	#bias: StemTensor;

	constructor(kernel: StemTensor, bias: StemTensor) {
		this.#kernel = kernel;
		this.#bias = bias;
	}

	static read(tensors: StemTensors): PresenceLayer | null {
		const name = PresenceLayer.#name;
		if (!tensors.has(`${name}/kernel`)) return null;
		return new PresenceLayer(tensors.take(`${name}/kernel`), tensors.take(`${name}/bias`));
	}

	pack(channels: number, stems: number): Float32Array<ArrayBuffer> {
		const weights = new Float32Array(channels * stems + stems);
		weights.set(this.#kernel.expect(channels, stems));
		weights.set(this.#bias.expect(stems), channels * stems);
		return weights;
	}
}
//#endregion
