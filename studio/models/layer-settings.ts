"use strict";

import "adaptive-extender/worker";
import { Model, Field, Enum, Nullable } from "adaptive-extender/worker";
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
//#region Background settings
export enum BackgroundFit {
	cover = "cover",
	contain = "contain",
	stretch = "stretch",
}

export enum BackgroundEffectKind {
	none = "none",
	shake = "shake",
	pulse = "pulse",
	parallax = "parallax",
}

export class BackgroundSettings extends LayerSettings {
	@Field(Enum.Of(BackgroundFit), { name: "fit" })
	fit: BackgroundFit = BackgroundFit.cover;

	@Field(Nullable.Of(String), { name: "image" })
	image: string | null = null;

	@Field(Enum.Of(BackgroundEffectKind), { name: "effect" })
	effect: BackgroundEffectKind = BackgroundEffectKind.pulse;

	@Field(Number, { name: "intensity" })
	intensity: number = 0.5;

	constructor();
	constructor(opacity: number, blend: Blend, fit: BackgroundFit, image: string | null, effect: BackgroundEffectKind, intensity: number);
	constructor(opacity?: number, blend?: Blend, fit?: BackgroundFit, image?: string | null, effect?: BackgroundEffectKind, intensity?: number) {
		if (opacity === undefined || blend === undefined || fit === undefined || image === undefined || effect === undefined || intensity === undefined) {
			super();
			return;
		}

		super("Background", opacity, blend);
		this.fit = fit;
		this.image = image;
		this.effect = effect;
		this.intensity = intensity;
	}

	get hasImage(): boolean { return this.image !== null; }
}
//#endregion
