"use strict";

import "adaptive-extender/core";
import { Model, Field, Enum } from "adaptive-extender/core";

//#region Stem tensor
export class StemTensor {
	#shape: readonly number[];
	#data: Float32Array;

	constructor(shape: readonly number[], data: Float32Array) {
		this.#shape = shape;
		this.#data = data;
	}

	get shape(): readonly number[] { return this.#shape; }

	expect(...shape: number[]): Float32Array {
		const actual = this.#shape;
		if (actual.length !== shape.length || actual.some((size, index) => size !== shape[index])) throw new TypeError(`Expected a weight of shape [${shape}], got [${actual}]`);
		return this.#data;
	}
}
//#endregion
//#region Stem tensors
export class StemTensors {
	#tensors: Map<string, StemTensor>;
	#taken: Set<string> = new Set();

	constructor(tensors: Map<string, StemTensor>) {
		this.#tensors = tensors;
	}

	has(name: string): boolean {
		return this.#tensors.has(name);
	}

	take(name: string): StemTensor {
		const tensor = this.#tensors.get(name);
		if (tensor === undefined) throw new ReferenceError(`The model has no weight '${name}' the network needs`);
		this.#taken.add(name);
		return tensor;
	}

	finish(): void {
		const taken = this.#taken;
		const unused: string[] = [];
		for (const name of this.#tensors.keys()) {
			if (!taken.has(name)) unused.push(name);
		}
		if (unused.length > 0) throw new TypeError(`The model has weights the network doesn't use: ${unused.join(", ")}`);
	}
}
//#endregion
//#region Stem weight
export class StemWeight extends Model {
	@Field(String, { name: "name" })
	name: string;

	@Field(Array.Of(Number), { name: "shape" })
	shape: number[];

	@Field(String, { name: "dtype" })
	dtype: string;

	constructor();
	constructor(name: string, shape: number[], dtype: string);
	constructor(name?: string, shape?: number[], dtype?: string) {
		if (name === undefined || shape === undefined || dtype === undefined) {
			super();
			return;
		}

		super();
		this.name = name;
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

	files(base: Readonly<URL>): URL[] {
		return this.paths.map(path => new URL(path, base));
	}
}
//#endregion
//#region Stem weights
export enum StemArchitecture {
	window = "window",
	time = "time",
}

export class StemWeights extends Model {
	@Field(Array.Of(StemWeightGroup), { name: "weightsManifest" })
	groups: StemWeightGroup[];

	@Field(Enum.Of(StemArchitecture), { name: "architecture" })
	architecture: StemArchitecture = StemArchitecture.window;

	constructor();
	constructor(groups: StemWeightGroup[], architecture: StemArchitecture);
	constructor(groups?: StemWeightGroup[], architecture?: StemArchitecture) {
		if (groups === undefined || architecture === undefined) {
			super();
			return;
		}

		super();
		this.groups = groups;
		this.architecture = architecture;
	}

	files(base: Readonly<URL>): URL[] {
		return this.groups.flatMap(group => group.files(base));
	}

	tensors(buffer: ArrayBuffer): StemTensors {
		const tensors: Map<string, StemTensor> = new Map();
		let offset = 0;
		for (const group of this.groups) {
			for (const weight of group.weights) {
				const { name } = weight;
				if (tensors.has(name)) throw new TypeError(`The manifest names the weight '${name}' twice`);
				tensors.set(name, weight.read(buffer, offset));
				offset += weight.length * Float32Array.BYTES_PER_ELEMENT;
			}
		}
		if (offset !== buffer.byteLength) throw new TypeError(`The manifest describes ${offset} bytes of weights, but the files hold ${buffer.byteLength}`);
		return new StemTensors(tensors);
	}
}
//#endregion
