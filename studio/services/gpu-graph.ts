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

	constructor(device: GPUDevice, channels: number, span: number) {
		this.#buffer = device.createBuffer({ size: channels * span * Float32Array.BYTES_PER_ELEMENT, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
		this.#channels = channels;
		this.#span = span;
	}

	get buffer(): GPUBuffer { return this.#buffer; }
	get channels(): number { return this.#channels; }
	get span(): number { return this.#span; }
}
//#endregion
//#region GPU step
class GpuStep {
	#pipeline: GPUComputePipeline;
	#group: GPUBindGroup;
	#columns: number;
	#rows: number;

	constructor(pipeline: GPUComputePipeline, group: GPUBindGroup, columns: number, rows: number) {
		this.#pipeline = pipeline;
		this.#group = group;
		this.#columns = columns;
		this.#rows = rows;
	}

	encode(pass: GPUComputePassEncoder): void {
		pass.setPipeline(this.#pipeline);
		pass.setBindGroup(0, this.#group);
		pass.dispatchWorkgroups(this.#columns, this.#rows);
	}
}
//#endregion
//#region GPU graph
export class GpuGraph {
	#device: GPUDevice;
	#steps: GpuStep[] = [];

	constructor(device: GPUDevice) {
		this.#device = device;
	}

	static async compile(device: GPUDevice, code: string, constants: Record<string, number>): Promise<GPUComputePipeline> {
		const module = device.createShaderModule({ code });
		return await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main", constants } });
	}

	activation(channels: number, span: number): GpuActivation {
		return new GpuActivation(this.#device, channels, span);
	}

	upload(data: ArrayBufferView<ArrayBuffer>, usage: number): GPUBuffer {
		const device = this.#device;
		const buffer = device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
		device.queue.writeBuffer(buffer, 0, data);
		return buffer;
	}

	dispatch(pipeline: GPUComputePipeline, buffers: readonly GPUBuffer[], columns: number, rows: number): void {
		const entries: GPUBindGroupEntry[] = [];
		for (let index = 0; index < buffers.length; index++) entries.push({ binding: index, resource: { buffer: buffers[index] } });
		const group = this.#device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries });
		this.#steps.push(new GpuStep(pipeline, group, columns, rows));
	}

	encode(pass: GPUComputePassEncoder): void {
		for (const step of this.#steps) step.encode(pass);
	}
}
//#endregion
