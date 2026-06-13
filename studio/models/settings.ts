"use strict";

import "adaptive-extender/core";
import { Model, Field, RecordOf, Optional } from "adaptive-extender/core";
import { Registry } from "../services/visualization-registry.js";

//#region Visualization settings
export class VisualizationSettings extends Model {
	@Field(Number, "quality")
	quality: number;

	@Field(Number, "smoothing")
	smoothing: number;

	@Field(Number, "focus")
	focus: number;

	@Field(Number, "spread")
	spread: number;

	@Field(Optional(Number), "boost")
	boost: number | undefined;

	@Field(Optional(Number), "tilt")
	tilt: number | undefined;

	@Field(Optional(Number), "punch")
	punch: number | undefined;

	constructor();
	constructor(quality: number, smoothing: number, focus: number, spread: number);
	constructor(quality?: number, smoothing?: number, focus?: number, spread?: number) {
		if (quality === undefined || smoothing === undefined || focus === undefined || spread === undefined) {
			super();
			return;
		}

		super();
		this.quality = quality;
		this.smoothing = smoothing;
		this.focus = focus;
		this.spread = spread;
	}
}
//#endregion
//#region Settings
export class Settings extends Model {
	@Field(Boolean, "is_opened_configurator")
	isOpenedConfigurator: boolean;

	@Field(Number, "rate")
	rate: number;

	@Field(Boolean, "auto_correct")
	autoCorrect: boolean;

	@Field(Optional(Boolean), "auto_train")
	autoTrain: boolean | undefined;

	@Field(String, "visualization")
	visualization: string;

	@Field(RecordOf(VisualizationSettings), "attachments")
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
		let config = this.attachments.get(this.visualization);
		if (config === undefined) {
			config = new VisualizationSettings(10, 0.8, -60, 30);
			this.attachments.set(this.visualization, config);
		}
		return config;
	}

	static get newDefault(): Settings {
		const configuration = new VisualizationSettings(10, 0.6, -60, 30);
		const attachments = new Map(Array.from(Registry.names(), name => [name, configuration]));
		const settings = new Settings(false, 240, true, undefined, Registry.default, attachments);
		return settings;
	}
}
//#endregion
