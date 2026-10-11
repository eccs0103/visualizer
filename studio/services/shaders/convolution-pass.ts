"use strict";

import "adaptive-extender/worker";
import { type ConvolutionLayer } from "../../models/stem-layers.js";
import { GpuGraph, type GpuActivation } from "../gpu-graph.js";

const { ceil } = Math;

//#region Convolution pass
/** How a block reads its input; the values are the `mode` the shader switches on. */
enum ConvolutionInput {
	plain,
	pooled,
	joined,
}

/** The convolution shader (`convolution.wgsl`): one U-Net block per dispatch. Max-pooling, upsampling and the skip concatenation are folded into how it reads its input. */
export class ConvolutionPass {
	static #file: string = "convolution.wgsl";
	static #lanes: number = 8;
	static #reach: number = 5;
	// Filters and positions each thread computes (at most 4 each), all bit-identical. Measured per inference (2026-10-08) on an Intel UHD 630: 2×4 29.4 ms, 4×4 33.7, 2×2 38.1, 1×4 36.2; on an RTX 3050: 2×4 5.71, 4×4 6.45, 2×2 5.37, 1×4 5.28. 2×4 is best where it matters most, on integrated GPUs.
	static #rows: number = 2;
	static #columns: number = 4;

	#pipeline: GPUComputePipeline;

	constructor(pipeline: GPUComputePipeline) {
		this.#pipeline = pipeline;
	}

	/** The shader's file in the shader folder the splitter fetches from. */
	static get file(): string { return ConvolutionPass.#file; }

	/** Compiles the shader `code` (the text of `file`). */
	static async compile(device: GPUDevice, code: string): Promise<ConvolutionPass> {
		return new ConvolutionPass(await GpuGraph.compile(device, code, { rows: ConvolutionPass.#rows, columns: ConvolutionPass.#columns }));
	}

	/** A block over `source` as it is. */
	convolve(graph: GpuGraph, layer: ConvolutionLayer, source: GpuActivation): GpuActivation {
		return this.#record(graph, layer, ConvolutionInput.plain, source, source, source.span);
	}

	/** A block over `source` max-pooled by 2. */
	pool(graph: GpuGraph, layer: ConvolutionLayer, source: GpuActivation): GpuActivation {
		return this.#record(graph, layer, ConvolutionInput.pooled, source, source, source.span / 2);
	}

	/** A block over `source` upsampled by 2, followed by the channels of `skip`. */
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
		// The shader's `struct Shape`, in its field order: inputs, skipped, filters, span, kernel, mode, then padding to 32 bytes.
		const shape = graph.upload(new Uint32Array([source.channels, skipped, filters, span, size, input, 0, 0]), GPUBufferUsage.UNIFORM);
		const lanes = ConvolutionPass.#lanes;
		// Bindings 0…4 of the shader: shape, source, skip, weights, result.
		graph.dispatch(this.#pipeline, [shape, source.buffer, skip.buffer, graph.upload(weights, GPUBufferUsage.STORAGE), result.buffer], ceil(filters / (lanes * ConvolutionPass.#rows)), ceil(span / (lanes * ConvolutionPass.#columns)));
		return result;
	}
}
//#endregion
