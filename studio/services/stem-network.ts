"use strict";

import "adaptive-extender/worker";
import { StemArchitecture, StemWeights, type StemTensors } from "../models/stem-weights.js";
import { ConvolutionLayer, HeadLayer, PresenceLayer } from "../models/stem-layers.js";
import { GpuGraph, type GpuActivation } from "./gpu-graph.js";
import { ConvolutionPass, HeadPass, PresencePass } from "./stem-passes.js";
import { type TapHistory } from "./tap-history.js";

const { ceil, max } = Math;

//#region Stem topology
abstract class StemTopology {
	#graph: GpuGraph;
	#input: GpuActivation;
	#output: GpuActivation;

	constructor(graph: GpuGraph, input: GpuActivation, output: GpuActivation) {
		if (new.target === StemTopology) throw new TypeError("Unable to create an instance of an abstract class");
		this.#graph = graph;
		this.#input = input;
		this.#output = output;
	}

	static create(architecture: StemArchitecture, device: GPUDevice, convolution: ConvolutionPass, softmax: HeadPass, presence: PresencePass, tensors: StemTensors, bins: number): StemTopology {
		switch (architecture) {
		case StemArchitecture.window: return StemUNet.record(device, convolution, softmax, presence, tensors, bins);
		case StemArchitecture.time: return TimeUNet.record(device, convolution, softmax, tensors, bins);
		default: throw new TypeError(`Invalid '${architecture}' architecture`);
		}
	}

	get graph(): GpuGraph { return this.#graph; }
	get input(): GpuActivation { return this.#input; }
	get output(): GpuActivation { return this.#output; }

	abstract get frames(): number;

	abstract feed(queue: GPUQueue, history: TapHistory): void;

	encode(pass: GPUComputePassEncoder): void {
		this.#graph.encode(pass);
	}
}
//#endregion
//#region Stem U-Net
class StemUNet extends StemTopology {
	static #blocks: number = 10;

	static record(device: GPUDevice, convolution: ConvolutionPass, softmax: HeadPass, presence: PresencePass, tensors: StemTensors, bins: number): StemUNet {
		const graph = new GpuGraph(device, 1);
		const layer = ConvolutionLayer.read.bind(ConvolutionLayer, tensors);
		const first = layer(1);
		const input = graph.activation(first.channels, bins);
		const down = convolution.convolve(graph, first, input);
		const down2 = convolution.convolve(graph, layer(3), convolution.pool(graph, layer(2), down));
		const down3 = convolution.convolve(graph, layer(5), convolution.pool(graph, layer(4), down2));
		const bottom = convolution.convolve(graph, layer(7), convolution.pool(graph, layer(6), down3));
		const up3 = convolution.join(graph, layer(8), bottom, down3);
		const up2 = convolution.join(graph, layer(9), up3, down2);
		const up = convolution.join(graph, layer(10), up2, down);
		const head = HeadLayer.read(tensors, StemUNet.#blocks + 1);
		const gate = PresenceLayer.read(tensors);
		const shares = gate === null ? PresencePass.open(graph, head.stems) : presence.record(graph, gate, bottom, head.stems);
		const output = softmax.record(graph, head, up, shares);
		tensors.finish();
		return new StemUNet(graph, input, output);
	}

	get frames(): number { return this.input.channels; }

	feed(queue: GPUQueue, history: TapHistory): void {
		const { buffer } = this.input;
		const window = history.pack();
		if (window.byteLength !== buffer.size) throw new TypeError(`Expected ${buffer.size / Float32Array.BYTES_PER_ELEMENT} input values, got ${window.length}`);
		queue.writeBuffer(buffer, 0, window);
	}
}
//#endregion
//#region Time U-Net
class TimeUNet extends StemTopology {
	static #blocks: number = 14;
	static #dilations: readonly number[] = Object.freeze([1, 2, 2, 4, 4, 8, 8, 16, 4, 1, 2, 1, 1, 1]);
	static #batch: number = 8;

	static record(device: GPUDevice, convolution: ConvolutionPass, softmax: HeadPass, tensors: StemTensors, bins: number): TimeUNet {
		const batch = TimeUNet.#batch;
		const dilations = TimeUNet.#dilations;
		const depth = 2 * max(...dilations) + batch;
		const graph = new GpuGraph(device, batch);
		const layer = ConvolutionLayer.read.bind(ConvolutionLayer, tensors);
		const plain = (number: number, source: GpuActivation) => convolution.convolve(graph, layer(number), source, dilations[number - 1], depth);
		const pooled = (number: number, source: GpuActivation) => convolution.pool(graph, layer(number), source, dilations[number - 1], depth);
		const joined = (number: number, source: GpuActivation, skip: GpuActivation) => convolution.join(graph, layer(number), source, skip, dilations[number - 1], depth);
		const input = graph.activation(1, bins, depth);
		const down = plain(2, plain(1, input));
		const down2 = plain(4, pooled(3, down));
		const down3 = plain(6, pooled(5, down2));
		const bottom = plain(8, pooled(7, down3));
		const up3 = plain(10, joined(9, bottom, down3));
		const up2 = plain(12, joined(11, up3, down2));
		const up = plain(14, joined(13, up2, down));
		const head = HeadLayer.read(tensors, TimeUNet.#blocks + 1);
		const output = softmax.record(graph, head, up, PresencePass.open(graph, head.stems));
		tensors.finish();
		return new TimeUNet(graph, input, output);
	}

	get frames(): number { return this.graph.batch; }

	feed(queue: GPUQueue, history: TapHistory): void {
		const { fresh, steps } = history;
		const window = history.pack();
		const { buffer, span, depth } = this.input;
		const first = window.length / span - fresh;
		for (let index = 0; index < fresh; index++) {
			const step = steps - fresh + 1 + index;
			queue.writeBuffer(buffer, (step % depth) * span * Float32Array.BYTES_PER_ELEMENT, window, (first + index) * span, span);
		}
		this.graph.tick(steps, fresh);
	}
}
//#endregion
//#region Pass timer
class PassTimer {
	static #size: number = 2 * BigUint64Array.BYTES_PER_ELEMENT;

	#queries: GPUQuerySet;
	#resolved: GPUBuffer;
	#writes: GPUComputePassTimestampWrites;
	#offset: number;

	constructor(device: GPUDevice, after: number) {
		const queries = this.#queries = device.createQuerySet({ type: "timestamp", count: 2 });
		this.#resolved = device.createBuffer({ size: PassTimer.#size, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
		this.#writes = { querySet: queries, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 };
		this.#offset = ceil(after / BigUint64Array.BYTES_PER_ELEMENT) * BigUint64Array.BYTES_PER_ELEMENT;
	}

	get writes(): GPUComputePassTimestampWrites { return this.#writes; }
	get end(): number { return this.#offset + PassTimer.#size; }

	read(range: ArrayBuffer): number | null {
		const [begin, end] = new BigUint64Array(range, this.#offset, 2);
		if (end <= begin) return null;
		return Number(end - begin) / 1_000_000;
	}

	copy(encoder: GPUCommandEncoder, target: GPUBuffer): void {
		const resolved = this.#resolved;
		encoder.resolveQuerySet(this.#queries, 0, 2, resolved, 0);
		encoder.copyBufferToBuffer(resolved, 0, target, this.#offset, PassTimer.#size);
	}
}
//#endregion
//#region Stem network
export class StemNetwork {
	static #depth: number = 2;

	#device: GPUDevice;
	#topology: StemTopology;
	#timer: PassTimer | null;
	#readbacks: GPUBuffer[];
	#cursor: number = 0;
	#stems: number;
	#result: Float32Array;
	#duration: number | null = null;

	constructor(device: GPUDevice, topology: StemTopology, stems: number, timer: PassTimer | null) {
		const { buffer, span } = topology.output;
		const size = timer === null ? buffer.size : timer.end;
		this.#device = device;
		this.#topology = topology;
		this.#timer = timer;
		this.#readbacks = Array.from({ length: StemNetwork.#depth }, () => device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }));
		this.#stems = stems;
		this.#result = new Float32Array(span * stems);
	}

	static async create(model: Readonly<URL>, shaders: Readonly<URL>, bins: number, stems: number): Promise<StemNetwork> {
		const device = await StemNetwork.#connect();
		const weights = await StemNetwork.#manifest(model);
		const tensors = await StemNetwork.#download(weights, model);
		const [code, code2, code3] = await Promise.all([ConvolutionPass.file, HeadPass.file, PresencePass.file].map(file => StemNetwork.#text(new URL(file, shaders))));
		device.pushErrorScope("validation");
		const [convolution, softmax, presence] = await Promise.all([ConvolutionPass.compile(device, code), HeadPass.compile(device, code2), PresencePass.compile(device, code3)]);
		const topology = StemTopology.create(weights.architecture, device, convolution, softmax, presence, tensors, bins);
		const error = await device.popErrorScope();
		if (error !== null) throw new TypeError(`WebGPU rejected the network: ${error.message}`);
		const { channels, buffer } = topology.output;
		if (channels < stems) throw new TypeError(`The model splits into ${channels} stems, the visualizer needs at least ${stems}`);
		const timer = device.features.has("timestamp-query") ? new PassTimer(device, buffer.size) : null;
		return new StemNetwork(device, topology, stems, timer);
	}

	static async #connect(): Promise<GPUDevice> {
		const { gpu } = navigator;
		if (gpu === undefined) throw new ReferenceError("This browser can't run the AI.");
		const adapter = await gpu.requestAdapter();
		if (adapter === null) throw new ReferenceError("The browser blocks the graphics card. Turn on \"Use graphics acceleration when available\" in the browser settings and restart it");
		const features: GPUFeatureName[] = adapter.features.has("timestamp-query") ? ["timestamp-query"] : [];
		return await adapter.requestDevice({ requiredFeatures: features });
	}

	static async #manifest(model: Readonly<URL>): Promise<StemWeights> {
		const response = await StemNetwork.#fetch(model);
		return StemWeights.import(await response.json(), "model");
	}

	static async #download(weights: StemWeights, model: Readonly<URL>): Promise<StemTensors> {
		const parts = await Promise.all(weights.paths.map(path => StemNetwork.#blob(new URL(path, model))));
		return weights.tensors(await new Blob(parts).arrayBuffer());
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

	static async #text(url: Readonly<URL>): Promise<string> {
		const response = await StemNetwork.#fetch(url);
		return await response.text();
	}

	get adapter(): string | null {
		const { vendor, architecture } = this.#device.adapterInfo;
		const name = `${vendor} ${architecture}`.trim();
		return name.length === 0 ? null : name;
	}

	get frames(): number { return this.#topology.frames; }
	get depth(): number { return this.#readbacks.length; }
	get duration(): number | null { return this.#duration; }
	get lost(): Promise<GPUDeviceLostInfo> { return this.#device.lost; }

	destroy(): void {
		this.#device.destroy();
	}

	async infer(history: TapHistory): Promise<Float32Array> {
		const device = this.#device;
		const readbacks = this.#readbacks;
		const cursor = this.#cursor;
		const readback = readbacks[cursor];
		this.#cursor = (cursor + 1) % readbacks.length;
		const topology = this.#topology;
		const timer = this.#timer;
		const { queue } = device;
		const { buffer } = topology.output;
		topology.feed(queue, history);

		const encoder = device.createCommandEncoder();
		const pass = encoder.beginComputePass(timer === null ? undefined : { timestampWrites: timer.writes });
		topology.encode(pass);
		pass.end();
		encoder.copyBufferToBuffer(buffer, 0, readback, 0, buffer.size);
		timer?.copy(encoder, readback);
		queue.submit([encoder.finish()]);

		await readback.mapAsync(GPUMapMode.READ);
		const range = readback.getMappedRange();
		this.#fold(new Float32Array(range, 0, buffer.size / Float32Array.BYTES_PER_ELEMENT));
		this.#duration = timer?.read(range) ?? null;
		readback.unmap();
		return this.#result;
	}

	#fold(shares: Float32Array): void {
		const { channels, span } = this.#topology.output;
		const stems = this.#stems;
		const result = this.#result;
		const last = stems - 1;
		for (let bin = 0; bin < span; bin++) {
			const source = bin * channels;
			const target = bin * stems;
			for (let stem = 0; stem < last; stem++) result[target + stem] = shares[source + stem];
			let rest = 0;
			for (let stem = last; stem < channels; stem++) rest += shares[source + stem];
			result[target + last] = rest;
		}
	}
}
//#endregion
