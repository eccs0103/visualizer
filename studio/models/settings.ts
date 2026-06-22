"use strict";

import "adaptive-extender/core";
import { Model, Field, Optional } from "adaptive-extender/core";
import { Registry } from "../services/visualization-registry.js";

//#region Visualization settings
export class VisualizationSettings extends Model {
	@Field(Number, { name: "quality" })
	quality: number = 10;

	@Field(Number, { name: "smoothing" })
	smoothing: number = 0.6;

	@Field(Number, { name: "focus" })
	focus: number = -60;

	@Field(Number, { name: "spread" })
	spread: number = 30;

	@Field(Number, { name: "boost" })
	boost: number = 1;

	@Field(Number, { name: "tilt" })
	tilt: number = 0;

	@Field(Number, { name: "punch" })
	punch: number = 0;

	constructor();
	constructor(quality: number, smoothing: number, focus: number, spread: number, boost: number, tilt: number, punch: number);
	constructor(quality?: number, smoothing?: number, focus?: number, spread?: number, boost?: number, tilt?: number, punch?: number) {
		if (quality === undefined || smoothing === undefined || focus === undefined || spread === undefined || boost === undefined || tilt === undefined || punch === undefined) {
			super();
			return;
		}

		super();
		this.quality = quality;
		this.smoothing = smoothing;
		this.focus = focus;
		this.spread = spread;
		this.boost = boost;
		this.tilt = tilt;
		this.punch = punch;
	}
}
//#endregion
//#region Settings
export class Settings extends Model {
	@Field(Boolean, { name: "is_opened_configurator" })
	isOpenedConfigurator: boolean = false;

	@Field(Number, { name: "rate" })
	rate: number = 240;

	@Field(Boolean, { name: "auto_correct" })
	autoCorrect: boolean = true;

	@Field(Optional.Of(Boolean), { name: "auto_train" })
	autoTrain: boolean | undefined;

	@Field(String, { name: "visualization" })
	visualization: string = Registry.default;

	@Field(Map.AsRecord(VisualizationSettings), { name: "attachments" })
	attachments: Map<string, VisualizationSettings> = new Map(Array.from(Registry.names(), name => [name, new VisualizationSettings()]));

	constructor();
	constructor(isOpenedConfigurator: boolean, rate: number, autoCorrect: boolean, autoTrain: boolean | undefined, visualization: string, attachments: Map<string, VisualizationSettings>);
	constructor(isOpenedConfigurator?: boolean, rate?: number, autoCorrect?: boolean, autoTrain?: boolean | undefined, visualization?: string, attachments?: Map<string, VisualizationSettings>) {
		if (isOpenedConfigurator === undefined || rate === undefined || autoCorrect === undefined || visualization === undefined || attachments === undefined) {
			super();
			return;
		}

		super();
		this.isOpenedConfigurator = isOpenedConfigurator;
		this.rate = rate;
		this.autoCorrect = autoCorrect;
		this.autoTrain = autoTrain;
		this.visualization = visualization;
		this.attachments = attachments;
	}

	get configuration(): VisualizationSettings {
		return ReferenceError.suppress(this.attachments.get(this.visualization), `Missing configurations for visualization '${this.visualization}'`);
	}
}
//#endregion
