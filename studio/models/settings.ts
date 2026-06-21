"use strict";

import "adaptive-extender/core";
import { Model, Field, Optional } from "adaptive-extender/core";
import { Registry } from "../services/visualization-registry.js";

//#region Visualization settings
export class VisualizationSettings extends Model {
	@Field(Number, { name: "quality" })
	quality: number;

	@Field(Number, { name: "smoothing" })
	smoothing: number;

	@Field(Number, { name: "focus" })
	focus: number;

	@Field(Number, { name: "spread" })
	spread: number;

	@Field(Number, { name: "boost", fallback: 1 })
	boost: number;

	@Field(Number, { name: "tilt", fallback: 0 })
	tilt: number;

	@Field(Number, { name: "punch", fallback: 0 })
	punch: number;

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

	static get newDefault(): VisualizationSettings {
		const quality = 10;
		const smoothing = 0.6;
		const focus = -60;
		const spread = 30;
		const boost = 1;
		const tilt = 0;
		const punch = 0;
		return new VisualizationSettings(quality, smoothing, focus, spread, boost, tilt, punch);
	}
}
//#endregion
//#region Settings
export class Settings extends Model {
	@Field(Boolean, { name: "is_opened_configurator" })
	isOpenedConfigurator: boolean;

	@Field(Number, { name: "rate" })
	rate: number;

	@Field(Boolean, { name: "auto_correct" })
	autoCorrect: boolean;

	@Field(Optional.Of(Boolean), { name: "auto_train" })
	autoTrain: boolean | undefined;

	@Field(String, { name: "visualization" })
	visualization: string;

	@Field(Map.AsRecord(VisualizationSettings), { name: "attachments" })
	attachments: Map<string, VisualizationSettings>;

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

	static get newDefault(): Settings {
		const isOpenedConfigurator = false;
		const rate = 240;
		const autoCorrect = true;
		const autoTrain = undefined;
		const visualization = Registry.default;
		const attachments = new Map(Array.from(Registry.names(), name => [name, VisualizationSettings.newDefault]));
		const settings = new Settings(isOpenedConfigurator, rate, autoCorrect, autoTrain, visualization, attachments);
		return settings;
	}
}
//#endregion
