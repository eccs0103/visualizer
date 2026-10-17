"use strict";

import "adaptive-extender/core";
import { Model, Field } from "adaptive-extender/core";

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
}
//#endregion
//#region Splitter catalog
export interface SplitterCatalogScheme {
	models: SplitterModelScheme[];
}

export class SplitterCatalog extends Model {
	@Field(Array.Of(SplitterModel), { name: "models" })
	models: SplitterModel[];

	#sizes: Map<SplitterModel, number> = new Map();

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

	size(model: SplitterModel): number | null {
		return this.#sizes.get(model) ?? null;
	}

	weigh(model: SplitterModel, size: number): void {
		this.#sizes.set(model, size);
	}
}
//#endregion
