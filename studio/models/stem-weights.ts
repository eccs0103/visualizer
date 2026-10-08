"use strict";

import "adaptive-extender/core";
import { Model, Field } from "adaptive-extender/core";

//#region Stem tensor
export class StemTensor {
	#shape: readonly number[];
	#data: Float32Array;

	constructor(shape: readonly number[], data: Float32Array) {
		this.#shape = shape;
		this.#data = data;
	}

	get shape(): readonly number[] { return this.#shape; }

	/** The values, after checking that the tensor has exactly the shape the network expects. */
	expect(...shape: number[]): Float32Array {
		const actual = this.#shape;
		if (actual.length !== shape.length || actual.some((size, index) => size !== shape[index])) throw new TypeError(`Expected a weight of shape [${shape}], got [${actual}]`);
		return this.#data;
	}
}
//#endregion
//#region Stem weight
export class StemWeight extends Model {
	@Field(Array.Of(Number), { name: "shape" })
	shape: number[];

	@Field(String, { name: "dtype" })
	dtype: string;

	constructor();
	constructor(shape: number[], dtype: string);
	constructor(shape?: number[], dtype?: string) {
		if (shape === undefined || dtype === undefined) {
			super();
			return;
		}

		super();
		this.shape = shape;
		this.dtype = dtype;
	}

	get length(): number {
		let length = 1;
		for (const size of this.shape) length *= size;
		return length;
	}

	read(buffer: ArrayBuffer, offset: number): StemTensor {
		const { dtype } = this;
		if (dtype !== "float32") throw new TypeError(`Unsupported weight type '${dtype}'`);
		return new StemTensor(this.shape, new Float32Array(buffer, offset, this.length));
	}
}
//#endregion
//#region Stem weight group
export class StemWeightGroup extends Model {
	@Field(Array.Of(String), { name: "paths" })
	paths: string[];

	@Field(Array.Of(StemWeight), { name: "weights" })
	weights: StemWeight[];

	constructor();
	constructor(paths: string[], weights: StemWeight[]);
	constructor(paths?: string[], weights?: StemWeight[]) {
		if (paths === undefined || weights === undefined) {
			super();
			return;
		}

		super();
		this.paths = paths;
		this.weights = weights;
	}
}
//#endregion
//#region Stem weights
/** The weights manifest of the splitter's `model.json`: which binary files hold the weights, and the shape of every tensor in the order they are stored. */
export class StemWeights extends Model {
	@Field(Array.Of(StemWeightGroup), { name: "weightsManifest" })
	groups: StemWeightGroup[];

	constructor();
	constructor(groups: StemWeightGroup[]);
	constructor(groups?: StemWeightGroup[]) {
		if (groups === undefined) {
			super();
			return;
		}

		super();
		this.groups = groups;
	}

	files(base: Readonly<URL>): URL[] {
		const files: URL[] = [];
		for (const group of this.groups) {
			for (const path of group.paths) files.push(new URL(path, base));
		}
		return files;
	}

	/** Cuts the concatenated weight files into tensors, in manifest order. */
	tensors(buffer: ArrayBuffer): StemTensor[] {
		const tensors: StemTensor[] = [];
		let offset = 0;
		for (const group of this.groups) {
			for (const weight of group.weights) {
				tensors.push(weight.read(buffer, offset));
				offset += weight.length * Float32Array.BYTES_PER_ELEMENT;
			}
		}
		if (offset !== buffer.byteLength) throw new TypeError(`The manifest describes ${offset} bytes of weights, but the files hold ${buffer.byteLength}`);
		return tensors;
	}
}
//#endregion
