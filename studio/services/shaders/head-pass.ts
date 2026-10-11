"use strict";

import "adaptive-extender/worker";
import { type HeadLayer } from "../../models/stem-layers.js";
import { GpuGraph, type GpuActivation } from "../gpu-graph.js";

const { ceil } = Math;

//#region Head pass
/** The head shader (`softmax.wgsl`): a 1×1 convolution to one logit per stem, then a softmax over the stems, each stem's share weighted by its presence. */
export class HeadPass {
	static #file: string = "softmax.wgsl";
	static #workgroup: number = 64;

	#pipeline: GPUComputePipeline;

	constructor(pipeline: GPUComputePipeline) {
		this.#pipeline = pipeline;
	}

	/** The shader's file in the shader folder the splitter fetches from. */
	static get file(): string { return HeadPass.#file; }

	/** Compiles the shader `code` (the text of `file`). */
	static async compile(device: GPUDevice, code: string): Promise<HeadPass> {
		return new HeadPass(await GpuGraph.compile(device, code, {}));
	}

	/** The stem shares, written bin-major (`span` rows of stems); `presence` holds one weight per stem. */
	record(graph: GpuGraph, layer: HeadLayer, source: GpuActivation, presence: GPUBuffer): GpuActivation {
		const { channels, span } = source;
		const { stems } = layer;
		const weights = layer.pack(channels);
		const result = graph.activation(stems, span);
		// The shader's `struct Shape`, in its field order: inputs, stems, span, then padding to 16 bytes.
		const shape = graph.upload(new Uint32Array([channels, stems, span, 0]), GPUBufferUsage.UNIFORM);
		// Bindings 0…4 of the shader: shape, source, weights, result, presence.
		graph.dispatch(this.#pipeline, [shape, source.buffer, graph.upload(weights, GPUBufferUsage.STORAGE), result.buffer, presence], ceil(span / HeadPass.#workgroup), 1);
		return result;
	}
}
//#endregion
