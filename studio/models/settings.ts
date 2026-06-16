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
