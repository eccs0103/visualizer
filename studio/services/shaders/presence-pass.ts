"use strict";

import "adaptive-extender/worker";
import { type PresenceLayer } from "../../models/stem-layers.js";
import { GpuGraph, type GpuActivation } from "../gpu-graph.js";

//#region Presence pass
/** The presence shader (`presence.wgsl`): judges per stem from the whole window whether that instrument plays at all (mean of the bottom block over positions → dense → sigmoid). */
export class PresencePass {
	static #file: string = "presence.wgsl";

	#pipeline: GPUComputePipeline;

	constructor(pipeline: GPUComputePipeline) {
		this.#pipeline = pipeline;
	}

	/** The shader's file in the shader folder the splitter fetches from. */
	static get file(): string { return PresencePass.#file; }

	/** Compiles the shader `code` (the text of `file`). */
	static async compile(device: GPUDevice, code: string): Promise<PresencePass> {
		return new PresencePass(await GpuGraph.compile(device, code, {}));
	}

	/** A presence of 1 for every stem: the gate of a model without one, which leaves the softmax exactly as it is. */
	static open(graph: GpuGraph, stems: number): GPUBuffer {
		return graph.upload(new Float32Array(stems).fill(1), GPUBufferUsage.STORAGE);
	}

	/** The presence of every stem, judged from `bottom`. */
	record(graph: GpuGraph, layer: PresenceLayer, bottom: GpuActivation, stems: number): GPUBuffer {
		const { channels, span } = bottom;
		const weights = layer.pack(channels, stems);
		const result = graph.activation(stems, 1);
		// The shader's `struct Shape`, in its field order: inputs, stems, span, then padding to 16 bytes.
		const shape = graph.upload(new Uint32Array([channels, stems, span, 0]), GPUBufferUsage.UNIFORM);
		// Bindings 0…3 of the shader: shape, source, weights, result.
		graph.dispatch(this.#pipeline, [shape, bottom.buffer, graph.upload(weights, GPUBufferUsage.STORAGE), result.buffer], 1, 1);
		return result.buffer;
	}
}
//#endregion
