"use strict";

import "adaptive-extender/worker";

// Every WebGPU browser has these flag tables, but TypeScript 7.0's built-in libraries do not declare them yet.
declare global {
	export interface GPUBufferUsageTable {
		MAP_READ: number;
		COPY_SRC: number;
		COPY_DST: number;
		UNIFORM: number;
		STORAGE: number;
		QUERY_RESOLVE: number;
	}

	export interface GPUMapModeTable {
		READ: number;
	}

	export const GPUBufferUsage: GPUBufferUsageTable;
	export const GPUMapMode: GPUMapModeTable;
}

//#region GPU activation
export class GpuActivation {
	#buffer: GPUBuffer;
	#channels: number;
	#span: number;
	#depth: number;

	constructor(device: GPUDevice, channels: number, span: number, depth: number) {
		this.#buffer = device.createBuffer({ size: depth * channels * span * Float32Array.BYTES_PER_ELEMENT, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
		this.#channels = channels;
		this.#span = span;
		this.#depth = depth;
	}

	get buffer(): GPUBuffer { return this.#buffer; }
	get channels(): number { return this.#channels; }
	get span(): number { return this.#span; }
	get depth(): number { return this.#depth; }
}
//#endregion
//#region GPU step
class GpuStep {
	#pipeline: GPUComputePipeline;
	#group: GPUBindGroup;
	#columns: number;
	#rows: number;
	#frames: number;

	constructor(pipeline: GPUComputePipeline, group: GPUBindGroup, columns: number, rows: number, frames: number) {
		this.#pipeline = pipeline;
		this.#group = group;
		this.#columns = columns;
		this.#rows = rows;
		this.#frames = frames;
	}

	encode(pass: GPUComputePassEncoder): void {
		pass.setPipeline(this.#pipeline);
		pass.setBindGroup(0, this.#group);
		pass.dispatchWorkgroups(this.#columns, this.#rows, this.#frames);
	}
}
//#endregion
//#region GPU graph
export class GpuGraph {
	#device: GPUDevice;
	#batch: number;
	#steps: GpuStep[] = [];
	#clock: GPUBuffer;
	#time: Uint32Array<ArrayBuffer> = new Uint32Array(2);

	constructor(device: GPUDevice, batch: number) {
		this.#device = device;
		this.#batch = batch;
		this.#clock = this.upload(new Uint32Array([0, 1]), GPUBufferUsage.UNIFORM);
	}

	static async compile(device: GPUDevice, code: string, constants: Record<string, number>): Promise<GPUComputePipeline> {
		const module = device.createShaderModule({ code });
		return await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main", constants } });
	}

	get batch(): number { return this.#batch; }
	get clock(): GPUBuffer { return this.#clock; }

	activation(channels: number, span: number, depth: number = 1): GpuActivation {
		return new GpuActivation(this.#device, channels, span, depth);
	}

	tick(step: number, frames: number): void {
		const batch = this.#batch;
		if (frames > batch) throw new TypeError(`Unable to run ${frames} frames at once, the graph holds ${batch}`);
		const time = this.#time;
		time[0] = step;
		time[1] = frames;
		this.#device.queue.writeBuffer(this.#clock, 0, time);
	}

	upload(data: ArrayBufferView<ArrayBuffer>, usage: number): GPUBuffer {
		const device = this.#device;
		const buffer = device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
		device.queue.writeBuffer(buffer, 0, data);
		return buffer;
	}

	dispatch(pipeline: GPUComputePipeline, buffers: readonly GPUBuffer[], columns: number, rows: number, frames: number = 1): void {
		const entries: GPUBindGroupEntry[] = [];
		for (let index = 0; index < buffers.length; index++) entries.push({ binding: index, resource: { buffer: buffers[index] } });
		const group = this.#device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries });
		this.#steps.push(new GpuStep(pipeline, group, columns, rows, frames));
	}

	encode(pass: GPUComputePassEncoder): void {
		for (const step of this.#steps) step.encode(pass);
	}
}
//#endregion
