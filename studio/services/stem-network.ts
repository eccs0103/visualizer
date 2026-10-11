"use strict";

import "adaptive-extender/worker";
import { StemWeights, type StemTensors } from "../models/stem-weights.js";
import { ConvolutionLayer, HeadLayer, PresenceLayer } from "../models/stem-layers.js";
import { GpuGraph, type GpuActivation } from "./gpu-graph.js";
import { ConvolutionPass, HeadPass, PresencePass } from "./stem-passes.js";

//#region Stem U-Net
class StemUNet {
	static #blocks: number = 10;

	#graph: GpuGraph;
	#input: GpuActivation;
	#output: GpuActivation;

	constructor(graph: GpuGraph, input: GpuActivation, output: GpuActivation) {
		this.#graph = graph;
		this.#input = input;
		this.#output = output;
	}

	static record(device: GPUDevice, convolution: ConvolutionPass, softmax: HeadPass, presence: PresencePass, tensors: StemTensors, frames: number, bins: number): StemUNet {
		const graph = new GpuGraph(device);
		const layer = ConvolutionLayer.read.bind(ConvolutionLayer, tensors);
		const input = graph.activation(frames, bins);
		const down = convolution.convolve(graph, layer(1), input);
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

	get input(): GpuActivation { return this.#input; }
	get output(): GpuActivation { return this.#output; }

	encode(pass: GPUComputePassEncoder): void {
		this.#graph.encode(pass);
	}
}
//#endregion
//#region Stem network
export class StemNetwork {
	#device: GPUDevice;
	#unet: StemUNet;
	#readback: GPUBuffer;
	#stems: number;
	#result: Float32Array;

	constructor(device: GPUDevice, unet: StemUNet, stems: number) {
		const { buffer, span } = unet.output;
		this.#device = device;
		this.#unet = unet;
		this.#readback = device.createBuffer({ size: buffer.size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
		this.#stems = stems;
		this.#result = new Float32Array(span * stems);
	}

	static async create(model: Readonly<URL>, shaders: Readonly<URL>, frames: number, bins: number, stems: number): Promise<StemNetwork> {
		const device = await StemNetwork.#connect();
		const tensors = await StemNetwork.#download(model);
		const [code, code2, code3] = await Promise.all([ConvolutionPass.file, HeadPass.file, PresencePass.file].map(file => StemNetwork.#text(new URL(file, shaders))));
		device.pushErrorScope("validation");
		const [convolution, softmax, presence] = await Promise.all([ConvolutionPass.compile(device, code), HeadPass.compile(device, code2), PresencePass.compile(device, code3)]);
		const unet = StemUNet.record(device, convolution, softmax, presence, tensors, frames, bins);
		const error = await device.popErrorScope();
		if (error !== null) throw new TypeError(`WebGPU rejected the network: ${error.message}`);
		const { channels } = unet.output;
		if (channels < stems) throw new TypeError(`The model splits into ${channels} stems, the visualizer needs at least ${stems}`);
		return new StemNetwork(device, unet, stems);
	}

	static async #connect(): Promise<GPUDevice> {
		const adapter = await navigator.gpu?.requestAdapter() ?? null;
		if (adapter === null) throw new ReferenceError("WebGPU is not available in this browser");
		return await adapter.requestDevice();
	}

	static async #download(model: Readonly<URL>): Promise<StemTensors> {
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

	static async #text(url: Readonly<URL>): Promise<string> {
		const response = await StemNetwork.#fetch(url);
		return await response.text();
	}

	get adapter(): string | null {
		const { vendor, architecture } = this.#device.adapterInfo;
		const name = `${vendor} ${architecture}`.trim();
		return name.length === 0 ? null : name;
	}

	get lost(): Promise<GPUDeviceLostInfo> { return this.#device.lost; }

	destroy(): void {
		this.#device.destroy();
	}

	async infer(input: Float32Array<ArrayBuffer>): Promise<Float32Array> {
		const device = this.#device;
		const readback = this.#readback;
		const unet = this.#unet;
		const { queue } = device;
		const target = unet.input.buffer;
		if (input.byteLength !== target.size) throw new TypeError(`Expected ${target.size / Float32Array.BYTES_PER_ELEMENT} input values, got ${input.length}`);
		queue.writeBuffer(target, 0, input);

		const encoder = device.createCommandEncoder();
		const pass = encoder.beginComputePass();
		unet.encode(pass);
		pass.end();
		encoder.copyBufferToBuffer(unet.output.buffer, 0, readback, 0, readback.size);
		queue.submit([encoder.finish()]);

		await readback.mapAsync(GPUMapMode.READ);
		this.#fold(new Float32Array(readback.getMappedRange()));
		readback.unmap();
		return this.#result;
	}

	#fold(shares: Float32Array): void {
		const { channels, span } = this.#unet.output;
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
