"use strict";

import "adaptive-extender/worker";
import { type HeadLayer } from "../models/stem-layers.js";
import { GpuGraph, type GpuActivation } from "./gpu-graph.js";

const { ceil } = Math;

//#region Head pass
export class HeadPass {
	static #file: string = "softmax.wgsl";
	static #workgroup: number = 64;

	#pipeline: GPUComputePipeline;

	constructor(pipeline: GPUComputePipeline) {
		this.#pipeline = pipeline;
	}

	static get file(): string { return HeadPass.#file; }

	static async compile(device: GPUDevice, code: string): Promise<HeadPass> {
		return new HeadPass(await GpuGraph.compile(device, code, {}));
	}

	record(graph: GpuGraph, layer: HeadLayer, source: GpuActivation, presence: GPUBuffer): GpuActivation {
		const { channels, span } = source;
		const { stems } = layer;
		const weights = layer.pack(channels);
		const result = graph.activation(stems, span);
		const shape = graph.upload(new Uint32Array([channels, stems, span, 0]), GPUBufferUsage.UNIFORM);
		graph.dispatch(this.#pipeline, [shape, source.buffer, graph.upload(weights, GPUBufferUsage.STORAGE), result.buffer, presence], ceil(span / HeadPass.#workgroup), 1);
		return result;
	}
}
//#endregion
