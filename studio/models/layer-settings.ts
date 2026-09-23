"use strict";

import "adaptive-extender/core";
import { Model, Field, Enum } from "adaptive-extender/core";
import { Blend } from "./blend.js";
import { type Layer } from "../services/layers.js";

//#region Layer settings
export class LayerSettings extends Model {
	@Field(String, { name: "name" })
	name: string;

	@Field(Number, { name: "opacity" })
	opacity: number;

	@Field(Enum.Of(Blend), { name: "blend" })
	blend: Blend;

	constructor();
	constructor(name: string, opacity: number, blend: Blend);
	constructor(name?: string, opacity?: number, blend?: Blend) {
		if (name === undefined || opacity === undefined || blend === undefined) {
			super();
			return;
		}

		super();
		this.name = name;
		this.opacity = opacity;
		this.blend = blend;
	}

	static fromLayer(layer: Layer): LayerSettings {
		return new LayerSettings(layer.name, layer.opacity, layer.blend);
	}

	matches(name: string): boolean {
		return this.name === name;
	}
}
//#endregion
