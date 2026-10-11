"use strict";

import "adaptive-extender/worker";
import { ConvolutionLayer, HeadLayer, PresenceLayer } from "../models/stem-layers.js";
import { type StemTensors } from "../models/stem-weights.js";
import { type GpuActivation, type GpuGraph } from "./gpu-graph.js";
import { type ConvolutionPass } from "./convolution-pass.js";
import { type HeadPass } from "./head-pass.js";
import { PresencePass } from "./presence-pass.js";

//#region Stem U-Net
export class StemUNet {
	static #blocks: number = 10;

	#input: GpuActivation;
	#output: GpuActivation;

	constructor(input: GpuActivation, output: GpuActivation) {
		this.#input = input;
		this.#output = output;
	}

	static record(graph: GpuGraph, convolution: ConvolutionPass, softmax: HeadPass, presence: PresencePass, tensors: StemTensors, frames: number, bins: number): StemUNet {
		const layer = (number: number): ConvolutionLayer => ConvolutionLayer.read(tensors, number);
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
		return new StemUNet(input, output);
	}

	get input(): GpuActivation { return this.#input; }

	get output(): GpuActivation { return this.#output; }
}
//#endregion
