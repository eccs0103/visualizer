"use strict";

import "adaptive-extender/core";
import { Model, Field, Enum } from "adaptive-extender/core";

const { round, max } = Math;

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
export interface StemWeightScheme {
	name: string;
	shape: number[];
	dtype: string;
}

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
export interface StemWeightGroupScheme {
	paths: string[];
	weights: StemWeightScheme[];
}

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
//#region Stem grid
export interface StemGridScheme {
	size: number;
	keep: number;
	group: number;
}

export class StemGrid extends Model {
	@Field(Number, { name: "size" })
	size: number;

	@Field(Number, { name: "keep" })
	keep: number;

	@Field(Number, { name: "group" })
	group: number;

	constructor();
	constructor(size: number, keep: number, group: number);
	constructor(size?: number, keep?: number, group?: number) {
		if (size === undefined || keep === undefined || group === undefined) {
			super();
			return;
		}

		super();
		this.size = size;
		this.keep = keep;
		this.group = group;
	}

	static get standard(): StemGrid { return new StemGrid(1024, 512, 1); }

	equals(other: StemGrid): boolean {
		return this.size === other.size && this.keep === other.keep && this.group === other.group;
	}

	merge(bytes: Uint8Array, target: Float32Array): void {
		const { keep, group } = this;
		const { length } = bytes;
		for (let index = 0; index < keep; index++) target[index] = bytes[index] / 255;
		for (let start = keep, column = keep; start < length; start += group, column++) {
			let sum = 0;
			for (let index = start; index < start + group; index++) sum += bytes[index];
			target[column] = round(sum / group) / 255;
		}
	}

	position(index: number, length: number): number {
		const { size, keep, group } = this;
		const column = index * ((size / 2 - 1) / max(1, length - 1));
		if (column <= keep - 1) return column;
		const middle = keep + (group - 1) / 2;
		if (column < middle) return keep - 1 + (column - keep + 1) / (middle - keep + 1);
		return keep + (column - middle) / group;
	}
}
//#endregion
//#region Stem weights
export enum StemArchitecture {
	window = "window",
	time = "time",
}

export interface StemWeightsScheme {
	weightsManifest: StemWeightGroupScheme[];
	architecture: StemArchitecture;
	grid: StemGridScheme;
}

export class StemWeights extends Model {
	@Field(Array.Of(StemWeightGroup), { name: "weightsManifest" })
	groups: StemWeightGroup[];

	@Field(Enum.Of(StemArchitecture), { name: "architecture" })
	architecture: StemArchitecture = StemArchitecture.window;

	@Field(StemGrid, { name: "grid" })
	grid: StemGrid = StemGrid.standard;

	constructor();
	constructor(groups: StemWeightGroup[], architecture: StemArchitecture, grid: StemGrid);
	constructor(groups?: StemWeightGroup[], architecture?: StemArchitecture, grid?: StemGrid) {
		if (groups === undefined || architecture === undefined || grid === undefined) {
			super();
			return;
		}

		super();
		this.groups = groups;
		this.architecture = architecture;
		this.grid = grid;
	}

	get paths(): string[] {
		return this.groups.flatMap(group => group.paths);
	}

	get length(): number {
		let length = 0;
		for (const group of this.groups) {
			for (const weight of group.weights) length += weight.length;
		}
		return length;
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
