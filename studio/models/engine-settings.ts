"use strict";

import "adaptive-extender/core";
import { Model, Field, Enum, Nullable } from "adaptive-extender/core";
import { Blend } from "./blend.js";
import { LayerSettings } from "./layer-settings.js";

//#region Background settings
export enum BackgroundFit {
	cover = "cover",
	contain = "contain",
	stretch = "stretch",
}

export class BackgroundSettings extends LayerSettings {
	@Field(Enum.Of(BackgroundFit), { name: "fit" })
	fit: BackgroundFit = BackgroundFit.cover;

	@Field(Nullable.Of(String), { name: "image" })
	image: string | null = null;

	constructor();
	constructor(opacity: number, blend: Blend, fit: BackgroundFit, image: string | null);
	constructor(opacity?: number, blend?: Blend, fit?: BackgroundFit, image?: string | null) {
		if (opacity === undefined || blend === undefined || fit === undefined || image === undefined) {
			super();
			return;
		}

		super("Background", opacity, blend);
		this.fit = fit;
		this.image = image;
	}

	get hasImage(): boolean { return this.image !== null; }
}
//#endregion
//#region Engine settings
export class EngineSettings extends Model {
	@Field(BackgroundSettings, { name: "background" })
	background: BackgroundSettings = new BackgroundSettings(1, Blend.normal, BackgroundFit.cover, null);

	@Field(LayerSettings, { name: "lyrics" })
	lyrics: LayerSettings = new LayerSettings("Lyrics", 1, Blend.normal);
}
//#endregion
