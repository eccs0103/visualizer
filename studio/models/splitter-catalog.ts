"use strict";

import "adaptive-extender/core";
import { Model, Field } from "adaptive-extender/core";
import { TextExpert } from "../services/text-expert.js";
import { type StemGrid, type StemWeights } from "./stem-weights.js";

//#region Splitter model
export interface SplitterModelScheme {
	folder: string;
	name: string;
	description: string;
}

export class SplitterModel extends Model {
	@Field(String, { name: "folder" })
	folder: string;

	@Field(String, { name: "name" })
	name: string;

	@Field(String, { name: "description" })
	description: string;

	#size: number | null = null;
	#grid: StemGrid | null = null;

	constructor();
	constructor(folder: string, name: string, description: string);
	constructor(folder?: string, name?: string, description?: string) {
		if (folder === undefined || name === undefined || description === undefined) {
			super();
			return;
		}

		super();
		this.folder = folder;
		this.name = name;
		this.description = description;
	}

	get label(): string {
		const size = this.#size;
		if (size === null) return this.name;
		return `${this.name} (${TextExpert.formatMillions(size)})`;
	}

	get grid(): StemGrid | null { return this.#grid; }

	weigh(weights: StemWeights): void {
		this.#size = weights.length;
		this.#grid = weights.grid;
	}
}
//#endregion
//#region Splitter catalog
export interface SplitterCatalogScheme {
	models: SplitterModelScheme[];
}

export class SplitterCatalog extends Model {
	@Field(Array.Of(SplitterModel), { name: "models" })
	models: SplitterModel[];

	constructor();
	constructor(models: SplitterModel[]);
	constructor(models?: SplitterModel[]) {
		if (models === undefined) {
			super();
			return;
		}

		super();
		this.models = models;
	}

	get first(): SplitterModel {
		const { models } = this;
		if (models.length < 1) throw new ReferenceError("The splitter catalog lists no models");
		return models[0];
	}

	find(folder: string): SplitterModel | null {
		return this.models.find(model => model.folder === folder) ?? null;
	}
}
//#endregion
