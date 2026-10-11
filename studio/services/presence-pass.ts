"use strict";

import "adaptive-extender/worker";
import { type PresenceLayer } from "../models/stem-layers.js";
import { GpuGraph, type GpuActivation } from "./gpu-graph.js";

//#region Presence pass
export class PresencePass {
	static #file: string = "presence.wgsl";

	#pipeline: GPUComputePipeline;

	constructor(pipeline: GPUComputePipeline) {
		this.#pipeline = pipeline;
	}

	static get file(): string { return PresencePass.#file; }

	static async compile(device: GPUDevice, code: string): Promise<PresencePass> {
		return new PresencePass(await GpuGraph.compile(device, code, {}));
	}

	static open(graph: GpuGraph, stems: number): GPUBuffer {
		return graph.upload(new Float32Array(stems).fill(1), GPUBufferUsage.STORAGE);
	}

	record(graph: GpuGraph, layer: PresenceLayer, bottom: GpuActivation, stems: number): GPUBuffer {
		const { channels, span } = bottom;
		const weights = layer.pack(channels, stems);
		const result = graph.activation(stems, 1);
		const shape = graph.upload(new Uint32Array([channels, stems, span, 0]), GPUBufferUsage.UNIFORM);
		graph.dispatch(this.#pipeline, [shape, bottom.buffer, graph.upload(weights, GPUBufferUsage.STORAGE), result.buffer], 1, 1);
		return result.buffer;
	}
}
//#endregion
