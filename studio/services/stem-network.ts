"use strict";

import "adaptive-extender/worker";
import { StemTensor, StemWeights } from "../models/stem-weights.js";

const { ceil, sqrt } = Math;

// Every WebGPU browser has these flag tables, but TypeScript 7.0's built-in libraries do not declare them yet.
declare global {
	interface GPUBufferUsageTable {
		MAP_READ: number;
		COPY_SRC: number;
		COPY_DST: number;
		UNIFORM: number;
		STORAGE: number;
	}

	interface GPUMapModeTable {
		READ: number;
	}

	const GPUBufferUsage: GPUBufferUsageTable;
	const GPUMapMode: GPUMapModeTable;
}

//#region Stem input
/** How a convolution block reads its input; the values are the `mode` the convolution shader switches on. */
enum StemInput {
	plain,
	pooled,
	joined,
}
//#endregion
//#region Stem activation
/** One GPU-resident activation, channel-major: `channels` rows of `span` positions. */
class StemActivation {
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
//#region Stem step
/** One compute dispatch with everything it binds, encoded the same way on every inference. */
class StemStep {
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
//#region Stem builder
/**
 * Turns the stored tensors into GPU buffers and dispatches, block by block. Trainable tensors are stored first
 * (per block: kernel, bias, gamma, beta; then the head's kernel and bias), the batch-norm statistics after them
 * (per block: mean, variance) — the order tfjs saved them in.
 */
class StemBuilder {
	static #epsilon: number = 1e-3;
	static #workgroup: number = 64;
	static #tile: number = 32;
	static #reach: number = 5;

	#device: GPUDevice;
	#convolution: GPUComputePipeline;
	#softmax: GPUComputePipeline;
	#trainables: Iterator<StemTensor>;
	#statistics: Iterator<StemTensor>;
	#steps: StemStep[] = [];

	constructor(device: GPUDevice, convolution: GPUComputePipeline, softmax: GPUComputePipeline, tensors: readonly StemTensor[]) {
		const blocks = (tensors.length - 2) / 6;
		this.#device = device;
		this.#convolution = convolution;
		this.#softmax = softmax;
		this.#trainables = tensors.slice(0, blocks * 4 + 2).values();
		this.#statistics = tensors.slice(blocks * 4 + 2).values();
	}

	get steps(): readonly StemStep[] { return this.#steps; }

	activation(channels: number, span: number): StemActivation {
		return new StemActivation(this.#device, channels, span);
	}

	convolve(source: StemActivation): StemActivation {
		return this.#block(StemInput.plain, source, source, source.span);
	}

	pool(source: StemActivation): StemActivation {
		return this.#block(StemInput.pooled, source, source, source.span / 2);
	}

	join(source: StemActivation, skip: StemActivation): StemActivation {
		const span = skip.span;
		if (source.span * 2 !== span) throw new TypeError(`Unable to join a span of ${source.span} with a skip of ${span}`);
		return this.#block(StemInput.joined, source, skip, span);
	}

	/** The head: a 1×1 convolution and a softmax over the stems, written bin-major (`span` rows of `stems`). */
	classify(source: StemActivation): StemActivation {
		const trainables = this.#trainables;
		const kernel = this.#next(trainables);
		const [, , stems] = kernel.shape;
		const { channels, span } = source;
		const weights = new Float32Array(channels * stems + stems);
		weights.set(kernel.expect(1, channels, stems));
		weights.set(this.#next(trainables).expect(stems), channels * stems);

		const result = this.activation(stems, span);
		const shape = this.#upload(new Uint32Array([channels, stems, span, 0]), GPUBufferUsage.UNIFORM);
		this.#dispatch(this.#softmax, [shape, source.buffer, this.#upload(weights, GPUBufferUsage.STORAGE), result.buffer], ceil(span / StemBuilder.#workgroup), 1);
		return result;
	}

	/** Throws when the model holds more tensors than the network used. */
	finish(): void {
		if (this.#trainables.next().done !== true || this.#statistics.next().done !== true) throw new TypeError("The model has more weights than the network uses");
	}

	#block(input: StemInput, source: StemActivation, skip: StemActivation, span: number): StemActivation {
		const trainables = this.#trainables;
		const statistics = this.#statistics;
		const kernel = this.#next(trainables);
		const [size, , filters] = kernel.shape;
		const reach = StemBuilder.#reach;
		if (size % 2 === 0 || size > reach) throw new TypeError(`Kernels must be odd and at most ${reach} wide, got ${size}`);
		const skipped = input === StemInput.joined ? skip.channels : 0;
		const channels = source.channels + skipped;
		const count = size * channels * filters;

		const weights = new Float32Array(count + filters * 3);
		weights.set(kernel.expect(size, channels, filters));
		weights.set(this.#next(trainables).expect(filters), count);
		const gamma = this.#next(trainables).expect(filters);
		const beta = this.#next(trainables).expect(filters);
		const mean = this.#next(statistics).expect(filters);
		const variance = this.#next(statistics).expect(filters);
		// Batch norm folded into a scale and a shift per filter: γ·(x − μ)/√(σ² + ε) + β = x·scale + shift.
		for (let unit = 0; unit < filters; unit++) {
			const scale = gamma[unit] / sqrt(variance[unit] + StemBuilder.#epsilon);
			weights[count + filters + unit] = scale;
			weights[count + filters * 2 + unit] = beta[unit] - mean[unit] * scale;
		}

		const result = this.activation(filters, span);
		const shape = this.#upload(new Uint32Array([source.channels, skipped, filters, span, size, input, 0, 0]), GPUBufferUsage.UNIFORM);
		const tile = StemBuilder.#tile;
		this.#dispatch(this.#convolution, [shape, source.buffer, skip.buffer, this.#upload(weights, GPUBufferUsage.STORAGE), result.buffer], ceil(filters / tile), ceil(span / tile));
		return result;
	}

	#next(tensors: Iterator<StemTensor>): StemTensor {
		const result = tensors.next();
		if (result.done === true) throw new TypeError("The model has fewer weights than the network needs");
		return result.value;
	}

	/** Binds `buffers` to bindings 0, 1, 2… of the pipeline, in order. */
	#dispatch(pipeline: GPUComputePipeline, buffers: readonly GPUBuffer[], columns: number, rows: number): void {
		const entries: GPUBindGroupEntry[] = [];
		for (let index = 0; index < buffers.length; index++) entries.push({ binding: index, resource: { buffer: buffers[index] } });
		const group = this.#device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries });
		this.#steps.push(new StemStep(pipeline, group, columns, rows));
	}

	#upload(data: ArrayBufferView<ArrayBuffer>, usage: number): GPUBuffer {
		const device = this.#device;
		const buffer = device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
		device.queue.writeBuffer(buffer, 0, data);
		return buffer;
	}
}
//#endregion
//#region Stem network
/**
 * The splitter's U-Net (the shipped architecture: 10 convolution blocks and a softmax head), run on the GPU
 * with two WebGPU compute shaders. Max-pooling, upsampling and the skip concatenations are folded into how
 * each convolution reads its input, so one inference is a single command buffer of 11 dispatches and one
 * small readback. Everything is allocated once in `create`; an inference only writes the input.
 */
export class StemNetwork {
	static #convolution: string = `
struct Shape {
	inputs: u32,
	skipped: u32,
	filters: u32,
	span: u32,
	kernel: u32,
	mode: u32,
}

@group(0) @binding(0) var<uniform> shape: Shape;
@group(0) @binding(1) var<storage, read> source: array<f32>;
@group(0) @binding(2) var<storage, read> skip: array<f32>;
@group(0) @binding(3) var<storage, read> weights: array<f32>;
@group(0) @binding(4) var<storage, read_write> result: array<f32>;

// mode 0: the source as it is; 1: the source max-pooled by 2; 2: the source upsampled by 2, then the skip's channels.
fn gather(channel: u32, position: u32) -> f32 {
	let span = shape.span;
	if (shape.mode == 1u) {
		let base = channel * span * 2u + position * 2u;
		return max(source[base], source[base + 1u]);
	}
	if (shape.mode == 2u) {
		if (channel < shape.inputs) {
			return source[channel * (span / 2u) + position / 2u];
		}
		return skip[(channel - shape.inputs) * span + position];
	}
	return source[channel * span + position];
}

// One workgroup computes a tile of 32 filters × 32 positions; each of its 8 × 8 threads owns 4 filters × 4 positions.
// Input channels are walked 8 at a time: the input strip and the weights for those channels are staged in workgroup
// memory once and then reused by every thread, instead of each thread reading them from storage on its own.
var<workgroup> strip: array<f32, 288>; // chunk × (tile + 5 - 1): the widest kernel is 5
var<workgroup> slab: array<f32, 1280>; // 5 × chunk × tile

@compute @workgroup_size(8, 8)
fn main(@builtin(workgroup_id) group: vec3<u32>, @builtin(local_invocation_id) lane: vec3<u32>, @builtin(local_invocation_index) local: u32) {
	const tile = 32u;
	const chunk = 8u;
	const block = 4u;
	let channels = shape.inputs + shape.skipped;
	let first = group.x * tile;
	let start = group.y * tile;
	let half = i32(shape.kernel / 2u);
	let window = tile + shape.kernel - 1u;
	let span = i32(shape.span);
	var sums: array<f32, 16>;

	for (var base = 0u; base < channels; base += chunk) {
		for (var index = local; index < chunk * window; index += 64u) {
			let channel = base + index / window;
			let at = i32(start + index % window) - half;
			var value = 0.0;
			if (channel < channels && at >= 0 && at < span) {
				value = gather(channel, u32(at));
			}
			strip[index] = value;
		}
		for (var index = local; index < shape.kernel * chunk * tile; index += 64u) {
			let tap = index / (chunk * tile);
			let channel = base + (index / tile) % chunk;
			let unit = first + index % tile;
			var value = 0.0;
			if (channel < channels && unit < shape.filters) {
				value = weights[(tap * channels + channel) * shape.filters + unit];
			}
			slab[index] = value;
		}
		workgroupBarrier();

		for (var tap = 0u; tap < shape.kernel; tap++) {
			for (var offset = 0u; offset < chunk; offset++) {
				var row: array<f32, 4>;
				var column: array<f32, 4>;
				for (var step = 0u; step < block; step++) {
					row[step] = slab[(tap * chunk + offset) * tile + lane.x * block + step];
					column[step] = strip[offset * window + lane.y * block + step + tap];
				}
				for (var filter_index = 0u; filter_index < block; filter_index++) {
					for (var position_index = 0u; position_index < block; position_index++) {
						sums[filter_index * block + position_index] += row[filter_index] * column[position_index];
					}
				}
			}
		}
		workgroupBarrier();
	}

	let count = shape.kernel * channels * shape.filters;
	for (var filter_index = 0u; filter_index < block; filter_index++) {
		let unit = first + lane.x * block + filter_index;
		if (unit >= shape.filters) {
			continue;
		}
		let bias = weights[count + unit];
		let scale = weights[count + shape.filters + unit];
		let shift = weights[count + 2u * shape.filters + unit];
		for (var position_index = 0u; position_index < block; position_index++) {
			let position = start + lane.y * block + position_index;
			if (position < shape.span) {
				result[unit * shape.span + position] = max(sums[filter_index * block + position_index] + bias, 0.0) * scale + shift;
			}
		}
	}
}
`;

	static #softmax: string = `
struct Shape {
	inputs: u32,
	stems: u32,
	span: u32,
	padding: u32,
}

@group(0) @binding(0) var<uniform> shape: Shape;
@group(0) @binding(1) var<storage, read> source: array<f32>;
@group(0) @binding(2) var<storage, read> weights: array<f32>;
@group(0) @binding(3) var<storage, read_write> result: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
	let position = id.x;
	if (position >= shape.span) {
		return;
	}
	let stems = shape.stems;
	let base = position * stems;
	let bias = shape.inputs * stems;
	var peak = -3.0e38;
	for (var stem = 0u; stem < stems; stem++) {
		var logit = weights[bias + stem];
		for (var channel = 0u; channel < shape.inputs; channel++) {
			logit += weights[channel * stems + stem] * source[channel * shape.span + position];
		}
		result[base + stem] = logit;
		peak = max(peak, logit);
	}
	var total = 0.0;
	for (var stem = 0u; stem < stems; stem++) {
		let power = exp(result[base + stem] - peak);
		result[base + stem] = power;
		total += power;
	}
	for (var stem = 0u; stem < stems; stem++) {
		result[base + stem] /= total;
	}
}
`;

	#device: GPUDevice;
	#input: StemActivation;
	#output: StemActivation;
	#readback: GPUBuffer;
	#steps: readonly StemStep[];

	constructor(device: GPUDevice, input: StemActivation, output: StemActivation, steps: readonly StemStep[]) {
		this.#device = device;
		this.#input = input;
		this.#output = output;
		this.#steps = steps;
		this.#readback = device.createBuffer({ size: output.buffer.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
	}

	/** Loads the model at `model` for `frames` input frames of `bins` bins each; throws when WebGPU is unavailable or the weights don't fit the architecture. */
	static async create(model: Readonly<URL>, frames: number, bins: number): Promise<StemNetwork> {
		const device = await StemNetwork.#connect();
		const tensors = await StemNetwork.#download(model);
		device.pushErrorScope("validation");
		const [convolution, softmax] = await Promise.all([StemNetwork.#compile(device, StemNetwork.#convolution), StemNetwork.#compile(device, StemNetwork.#softmax)]);
		const builder = new StemBuilder(device, convolution, softmax, tensors);
		const input = builder.activation(frames, bins);
		const e0 = builder.convolve(input);
		const e1 = builder.convolve(builder.pool(e0));
		const e2 = builder.convolve(builder.pool(e1));
		const bottom = builder.convolve(builder.pool(e2));
		const d2 = builder.join(bottom, e2);
		const d1 = builder.join(d2, e1);
		const d0 = builder.join(d1, e0);
		const output = builder.classify(d0);
		builder.finish();
		const error = await device.popErrorScope();
		if (error !== null) throw new TypeError(`WebGPU rejected the network: ${error.message}`);
		return new StemNetwork(device, input, output, builder.steps);
	}

	static async #connect(): Promise<GPUDevice> {
		const adapter = await navigator.gpu?.requestAdapter() ?? null;
		if (adapter === null) throw new ReferenceError("WebGPU is not available in this browser");
		return await adapter.requestDevice();
	}

	static async #download(model: Readonly<URL>): Promise<StemTensor[]> {
		const response = await StemNetwork.#fetch(model);
		const manifest = StemWeights.import(await response.json(), "model");
		const parts = await Promise.all(manifest.files(model).map(StemNetwork.#bytes));
		return manifest.tensors(StemNetwork.#concatenate(parts));
	}

	static async #fetch(url: Readonly<URL>): Promise<Response> {
		const response = await fetch(url);
		if (!response.ok) throw new ReferenceError(`Unable to load '${url}': ${response.status} ${response.statusText}`);
		return response;
	}

	static async #bytes(url: Readonly<URL>): Promise<ArrayBuffer> {
		const response = await StemNetwork.#fetch(url);
		return await response.arrayBuffer();
	}

	static #concatenate(parts: readonly ArrayBuffer[]): ArrayBuffer {
		if (parts.length === 1) return parts[0];
		let size = 0;
		for (const part of parts) size += part.byteLength;
		const whole = new Uint8Array(size);
		let offset = 0;
		for (const part of parts) {
			whole.set(new Uint8Array(part), offset);
			offset += part.byteLength;
		}
		return whole.buffer;
	}

	static async #compile(device: GPUDevice, code: string): Promise<GPUComputePipeline> {
		const module = device.createShaderModule({ code });
		return await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main" } });
	}

	get stems(): number { return this.#output.channels; }

	/** The GPU the browser gave the network, e.g. "nvidia ampere"; `null` when the browser doesn't say. */
	get adapter(): string | null {
		const { vendor, architecture } = this.#device.adapterInfo;
		const name = `${vendor} ${architecture}`.trim();
		return name.length === 0 ? null : name;
	}

	/** Resolves when the GPU device is lost (driver reset, GPU removed); the network can't run after that. */
	get lost(): Promise<GPUDeviceLostInfo> { return this.#device.lost; }

	/** `input` is channel-major — one row of bins per frame, oldest frame first; the result is the stem shares, bin-major (`stems` per bin). */
	async infer(input: Float32Array<ArrayBuffer>): Promise<Float32Array> {
		const device = this.#device;
		const readback = this.#readback;
		const { queue } = device;
		const target = this.#input.buffer;
		if (input.byteLength !== target.size) throw new TypeError(`Expected ${target.size / Float32Array.BYTES_PER_ELEMENT} input values, got ${input.length}`);
		queue.writeBuffer(target, 0, input);

		const encoder = device.createCommandEncoder();
		const pass = encoder.beginComputePass();
		for (const step of this.#steps) step.encode(pass);
		pass.end();
		encoder.copyBufferToBuffer(this.#output.buffer, 0, readback, 0, readback.size);
		queue.submit([encoder.finish()]);

		await readback.mapAsync(GPUMapMode.READ);
		const result = new Float32Array(readback.getMappedRange().slice(0));
		readback.unmap();
		return result;
	}
}
//#endregion
