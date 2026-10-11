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
 * Turns the stored tensors into GPU buffers and dispatches, block by block. Trainable tensors are stored first (per block: kernel, bias, gamma, beta; then the head's kernel and bias; then, in a gated model, the presence gate's kernel and bias), the batch-norm statistics after them (per block: mean, variance) — the order tfjs saved them in.
 */
class StemBuilder {
	static #epsilon: number = 1e-3;
	static #workgroup: number = 64;
	static #lanes: number = 8;
	static #reach: number = 5;
	// Filters and positions each convolution thread computes (at most 4 each), all bit-identical. Measured per inference (2026-10-08) on an Intel UHD 630: 2×4 29.4 ms, 4×4 33.7, 2×2 38.1, 1×4 36.2; on an RTX 3050: 2×4 5.71, 4×4 6.45, 2×2 5.37, 1×4 5.28. 2×4 is best where it matters most, on integrated GPUs.
	static #rows: number = 2;
	static #columns: number = 4;

	/** The convolution shader's pipeline constants for the tile shape the dispatches are sized for. */
	static get tiling(): Record<string, number> {
		return { rows: StemBuilder.#rows, columns: StemBuilder.#columns };
	}

	#device: GPUDevice;
	#convolution: GPUComputePipeline;
	#softmax: GPUComputePipeline;
	#presence: GPUComputePipeline;
	#gated: boolean;
	#trainables: Iterator<StemTensor>;
	#statistics: Iterator<StemTensor>;
	#steps: StemStep[] = [];

	constructor(device: GPUDevice, convolution: GPUComputePipeline, softmax: GPUComputePipeline, presence: GPUComputePipeline, tensors: readonly StemTensor[]) {
		// Per block 6 tensors, plus the head's 2, plus the gate's 2 in a gated model.
		const gated = (tensors.length - 2) % 6 !== 0;
		const head = gated ? 4 : 2;
		const blocks = (tensors.length - head) / 6;
		this.#device = device;
		this.#convolution = convolution;
		this.#softmax = softmax;
		this.#presence = presence;
		this.#gated = gated;
		this.#trainables = tensors.slice(0, blocks * 4 + head).values();
		this.#statistics = tensors.slice(blocks * 4 + head).values();
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

	/** The head: a 1×1 convolution and a softmax over the stems, written bin-major (`span` rows of `stems`), each stem's share weighted by its presence (judged from `bottom` in a gated model, 1 otherwise). */
	classify(source: StemActivation, bottom: StemActivation): StemActivation {
		const trainables = this.#trainables;
		const kernel = this.#next(trainables);
		const [, , stems] = kernel.shape;
		const { channels, span } = source;
		const weights = new Float32Array(channels * stems + stems);
		weights.set(kernel.expect(1, channels, stems));
		weights.set(this.#next(trainables).expect(stems), channels * stems);
		const presence = this.#gate(bottom, stems);

		const result = this.activation(stems, span);
		const shape = this.#upload(new Uint32Array([channels, stems, span, 0]), GPUBufferUsage.UNIFORM);
		this.#dispatch(this.#softmax, [shape, source.buffer, this.#upload(weights, GPUBufferUsage.STORAGE), result.buffer, presence], ceil(span / StemBuilder.#workgroup), 1);
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
		const lanes = StemBuilder.#lanes;
		this.#dispatch(this.#convolution, [shape, source.buffer, skip.buffer, this.#upload(weights, GPUBufferUsage.STORAGE), result.buffer], ceil(filters / (lanes * StemBuilder.#rows)), ceil(span / (lanes * StemBuilder.#columns)));
		return result;
	}

	/** The presence of every stem: in a gated model a dispatch that judges it from the whole window (mean of `bottom` over positions → dense → sigmoid), otherwise a constant 1 per stem. */
	#gate(bottom: StemActivation, stems: number): GPUBuffer {
		if (!this.#gated) return this.#upload(new Float32Array(stems).fill(1), GPUBufferUsage.STORAGE);
		const trainables = this.#trainables;
		const { channels, span } = bottom;
		const weights = new Float32Array(channels * stems + stems);
		weights.set(this.#next(trainables).expect(channels, stems));
		weights.set(this.#next(trainables).expect(stems), channels * stems);
		const result = this.activation(stems, 1);
		const shape = this.#upload(new Uint32Array([channels, stems, span, 0]), GPUBufferUsage.UNIFORM);
		this.#dispatch(this.#presence, [shape, bottom.buffer, this.#upload(weights, GPUBufferUsage.STORAGE), result.buffer], 1, 1);
		return result.buffer;
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
 * The splitter's U-Net (the shipped architecture: 10 convolution blocks and a softmax head), run on the GPU with two WebGPU compute shaders. Max-pooling, upsampling and the skip concatenations are folded into how each convolution reads its input, so one inference is a single command buffer of 11 dispatches and one small readback. Everything is allocated once in `create`; an inference only writes the input.
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

// One workgroup of 8 × 8 threads computes a tile of height filters × width positions; each thread owns rows filters × columns positions (at most 4 × 4).
// Input channels are walked 8 at a time: the input strip and the weights for those channels are staged in workgroup memory once and then reused by every thread, instead of each thread reading them from storage on its own.
override rows: u32 = 4u;
override columns: u32 = 4u;
override height: u32 = 8u * rows;
override width: u32 = 8u * columns;
override strip_size: u32 = 8u * (width + 4u); // chunk × (width + 5 - 1): the widest kernel is 5
override slab_size: u32 = 5u * 8u * height; // 5 × chunk × height

var<workgroup> strip: array<f32, strip_size>;
var<workgroup> slab: array<f32, slab_size>;

@compute @workgroup_size(8, 8)
fn main(@builtin(workgroup_id) group: vec3<u32>, @builtin(local_invocation_id) lane: vec3<u32>, @builtin(local_invocation_index) local: u32) {
	const chunk = 8u;
	let channels = shape.inputs + shape.skipped;
	let first = group.x * height;
	let start = group.y * width;
	let half = i32(shape.kernel / 2u);
	let window = width + shape.kernel - 1u;
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
		for (var index = local; index < shape.kernel * chunk * height; index += 64u) {
			let tap = index / (chunk * height);
			let channel = base + (index / height) % chunk;
			let unit = first + index % height;
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
				for (var step = 0u; step < rows; step++) {
					row[step] = slab[(tap * chunk + offset) * height + lane.x * rows + step];
				}
				for (var step = 0u; step < columns; step++) {
					column[step] = strip[offset * window + lane.y * columns + step + tap];
				}
				for (var filter_index = 0u; filter_index < rows; filter_index++) {
					for (var position_index = 0u; position_index < columns; position_index++) {
						sums[filter_index * columns + position_index] += row[filter_index] * column[position_index];
					}
				}
			}
		}
		workgroupBarrier();
	}

	let count = shape.kernel * channels * shape.filters;
	for (var filter_index = 0u; filter_index < rows; filter_index++) {
		let unit = first + lane.x * rows + filter_index;
		if (unit >= shape.filters) {
			continue;
		}
		let bias = weights[count + unit];
		let scale = weights[count + shape.filters + unit];
		let shift = weights[count + 2u * shape.filters + unit];
		for (var position_index = 0u; position_index < columns; position_index++) {
			let position = start + lane.y * columns + position_index;
			if (position < shape.span) {
				result[unit * shape.span + position] = max(sums[filter_index * columns + position_index] + bias, 0.0) * scale + shift;
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
@group(0) @binding(4) var<storage, read> presence: array<f32>; // per stem; 1 for an ungated model, which leaves the softmax exactly as it is

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
		let power = exp(result[base + stem] - peak) * presence[stem];
		result[base + stem] = power;
		total += power;
	}
	for (var stem = 0u; stem < stems; stem++) {
		result[base + stem] /= total;
	}
}
`;

	static #presence: string = `
struct Shape {
	inputs: u32,
	stems: u32,
	span: u32,
	padding: u32,
}

@group(0) @binding(0) var<uniform> shape: Shape;
@group(0) @binding(1) var<storage, read> source: array<f32>; // the bottom block, inputs rows of span positions
@group(0) @binding(2) var<storage, read> weights: array<f32>; // dense kernel inputs × stems, then the bias per stem
@group(0) @binding(3) var<storage, read_write> result: array<f32>; // presence per stem

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
	let stem = id.x;
	if (stem >= shape.stems) {
		return;
	}
	var logit = weights[shape.inputs * shape.stems + stem];
	for (var channel = 0u; channel < shape.inputs; channel++) {
		var sum = 0.0;
		for (var position = 0u; position < shape.span; position++) {
			sum += source[channel * shape.span + position];
		}
		logit += weights[channel * shape.stems + stem] * (sum / f32(shape.span));
	}
	result[stem] = 1.0 / (1.0 + exp(-logit));
}
`;

	#device: GPUDevice;
	#input: StemActivation;
	#output: StemActivation;
	#readback: GPUBuffer;
	#result: Float32Array;
	#steps: readonly StemStep[];

	constructor(device: GPUDevice, input: StemActivation, output: StemActivation, steps: readonly StemStep[]) {
		const { size } = output.buffer;
		this.#device = device;
		this.#input = input;
		this.#output = output;
		this.#steps = steps;
		this.#readback = device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
		this.#result = new Float32Array(size / Float32Array.BYTES_PER_ELEMENT);
	}

	/** Loads the model at `model` for `frames` input frames of `bins` bins each; throws when WebGPU is unavailable or the weights don't fit the architecture. */
	static async create(model: Readonly<URL>, frames: number, bins: number): Promise<StemNetwork> {
		const device = await StemNetwork.#connect();
		const tensors = await StemNetwork.#download(model);
		device.pushErrorScope("validation");
		const [convolution, softmax, presence] = await Promise.all([StemNetwork.#compile(device, StemNetwork.#convolution, StemBuilder.tiling), StemNetwork.#compile(device, StemNetwork.#softmax, {}), StemNetwork.#compile(device, StemNetwork.#presence, {})]);
		const builder = new StemBuilder(device, convolution, softmax, presence, tensors);
		const input = builder.activation(frames, bins);
		const down = builder.convolve(input);
		const down2 = builder.convolve(builder.pool(down));
		const down3 = builder.convolve(builder.pool(down2));
		const bottom = builder.convolve(builder.pool(down3));
		const up3 = builder.join(bottom, down3);
		const up2 = builder.join(up3, down2);
		const up = builder.join(up2, down);
		const output = builder.classify(up, bottom);
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
		const parts = await Promise.all(manifest.files(model).map(StemNetwork.#blob));
		return manifest.tensors(await new Blob(parts).arrayBuffer());
	}

	static async #fetch(url: Readonly<URL>): Promise<Response> {
		const response = await fetch(url);
		if (!response.ok) throw new ReferenceError(`Unable to load '${url}': ${response.status} ${response.statusText}`);
		return response;
	}

	static async #blob(url: Readonly<URL>): Promise<Blob> {
		const response = await StemNetwork.#fetch(url);
		return await response.blob();
	}

	static async #compile(device: GPUDevice, code: string, constants: Record<string, number>): Promise<GPUComputePipeline> {
		const module = device.createShaderModule({ code });
		return await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "main", constants } });
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

	/** Releases the GPU device; `lost` then resolves with the reason "destroyed". */
	destroy(): void {
		this.#device.destroy();
	}

	/** `input` is channel-major — one row of bins per frame, oldest frame first; the result is the stem shares, bin-major (`stems` per bin). The result array is reused by the next call, so read it before inferring again. */
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
		const result = this.#result;
		result.set(new Float32Array(readback.getMappedRange()));
		readback.unmap();
		return result;
	}
}
//#endregion
