"use strict";

import "adaptive-extender/worker";
import { StemWeights, type StemTensors } from "../models/stem-weights.js";
import { GpuGraph } from "./gpu-graph.js";
import { StemUNet } from "./stem-unet.js";
import { ConvolutionPass } from "./shaders/convolution-pass.js";
import { HeadPass } from "./shaders/head-pass.js";
import { PresencePass } from "./shaders/presence-pass.js";

//#region Stem network
/**
 * The splitter's U-Net (`StemUNet`), run on the GPU with WebGPU compute shaders fetched from the server (`resources/shaders/`). One inference is a single command buffer of the recorded dispatches and one small readback. Everything is allocated once in `create`; an inference only writes the input.
 */
export class StemNetwork {
	#device: GPUDevice;
	#graph: GpuGraph;
	#unet: StemUNet;
	#readback: GPUBuffer;
	#result: Float32Array;

	constructor(device: GPUDevice, graph: GpuGraph, unet: StemUNet) {
		const { size } = unet.output.buffer;
		this.#device = device;
		this.#graph = graph;
		this.#unet = unet;
		this.#readback = device.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
		this.#result = new Float32Array(size / Float32Array.BYTES_PER_ELEMENT);
	}

	/** Loads the model at `model`, with the shaders from the folder `shaders`, for `frames` input frames of `bins` bins each; throws when WebGPU is unavailable or the weights don't fit the architecture. */
	static async create(model: Readonly<URL>, shaders: Readonly<URL>, frames: number, bins: number): Promise<StemNetwork> {
		const device = await StemNetwork.#connect();
		const tensors = await StemNetwork.#download(model);
		const [code, code2, code3] = await Promise.all([ConvolutionPass.file, HeadPass.file, PresencePass.file].map(file => StemNetwork.#text(new URL(file, shaders))));
		device.pushErrorScope("validation");
		const [convolution, softmax, presence] = await Promise.all([ConvolutionPass.compile(device, code), HeadPass.compile(device, code2), PresencePass.compile(device, code3)]);
		const graph = new GpuGraph(device);
		const unet = StemUNet.record(graph, convolution, softmax, presence, tensors, frames, bins);
		const error = await device.popErrorScope();
		if (error !== null) throw new TypeError(`WebGPU rejected the network: ${error.message}`);
		return new StemNetwork(device, graph, unet);
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

	get stems(): number { return this.#unet.output.channels; }

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
		const unet = this.#unet;
		const { queue } = device;
		const target = unet.input.buffer;
		if (input.byteLength !== target.size) throw new TypeError(`Expected ${target.size / Float32Array.BYTES_PER_ELEMENT} input values, got ${input.length}`);
		queue.writeBuffer(target, 0, input);

		const encoder = device.createCommandEncoder();
		const pass = encoder.beginComputePass();
		this.#graph.encode(pass);
		pass.end();
		encoder.copyBufferToBuffer(unet.output.buffer, 0, readback, 0, readback.size);
		queue.submit([encoder.finish()]);

		await readback.mapAsync(GPUMapMode.READ);
		const result = this.#result;
		result.set(new Float32Array(readback.getMappedRange()));
		readback.unmap();
		return result;
	}
}
//#endregion
