"use strict";

import "adaptive-extender/worker";
import { type ConvolutionLayer } from "../models/stem-layers.js";
import { GpuGraph, type GpuActivation } from "./gpu-graph.js";

const { ceil } = Math;

//#region Convolution pass
enum ConvolutionInput {
	plain,
	pooled,
	joined,
}

export class ConvolutionPass {
	static #file: string = "convolution.wgsl";
	static #lanes: number = 8;
	static #reach: number = 5;
	// Per inference, 2026-10-08: Intel UHD 630 2×4 29.4 ms, 4×4 33.7, 2×2 38.1; RTX 3050 2×4 5.71 ms, 2×2 5.37. 2×4 wins where it matters, on integrated GPUs.
	static #rows: number = 2;
	static #columns: number = 4;

	#pipeline: GPUComputePipeline;

	constructor(pipeline: GPUComputePipeline) {
		this.#pipeline = pipeline;
	}

	static get file(): string { return ConvolutionPass.#file; }

	static async compile(device: GPUDevice, code: string): Promise<ConvolutionPass> {
		return new ConvolutionPass(await GpuGraph.compile(device, code, { rows: ConvolutionPass.#rows, columns: ConvolutionPass.#columns, reach: ConvolutionPass.#reach }));
	}

	convolve(graph: GpuGraph, layer: ConvolutionLayer, source: GpuActivation): GpuActivation {
		return this.#record(graph, layer, ConvolutionInput.plain, source, source, source.span);
	}

	pool(graph: GpuGraph, layer: ConvolutionLayer, source: GpuActivation): GpuActivation {
		return this.#record(graph, layer, ConvolutionInput.pooled, source, source, source.span / 2);
	}

	join(graph: GpuGraph, layer: ConvolutionLayer, source: GpuActivation, skip: GpuActivation): GpuActivation {
		const span = skip.span;
		if (source.span * 2 !== span) throw new TypeError(`Unable to join a span of ${source.span} with a skip of ${span}`);
		return this.#record(graph, layer, ConvolutionInput.joined, source, skip, span);
	}

	#record(graph: GpuGraph, layer: ConvolutionLayer, input: ConvolutionInput, source: GpuActivation, skip: GpuActivation, span: number): GpuActivation {
		const { size, filters } = layer;
		const reach = ConvolutionPass.#reach;
		if (size % 2 === 0 || size > reach) throw new TypeError(`Kernels must be odd and at most ${reach} wide, got ${size}`);
		const skipped = input === ConvolutionInput.joined ? skip.channels : 0;
		const weights = layer.pack(source.channels + skipped);
		const result = graph.activation(filters, span);
		const shape = graph.upload(new Uint32Array([source.channels, skipped, filters, span, size, input, 0, 0]), GPUBufferUsage.UNIFORM);
		const lanes = ConvolutionPass.#lanes;
		graph.dispatch(this.#pipeline, [shape, source.buffer, skip.buffer, graph.upload(weights, GPUBufferUsage.STORAGE), result.buffer], ceil(filters / (lanes * ConvolutionPass.#rows)), ceil(span / (lanes * ConvolutionPass.#columns)));
		return result;
	}
}
//#endregion
