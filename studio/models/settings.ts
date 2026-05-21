"use strict";

import "adaptive-extender/core";
import { Model, Field, RecordOf } from "adaptive-extender/core";
import { Visualizer } from "../services/visualizer.js";

//#region Visualization configuration
export class VisualizationConfiguration extends Model {
	@Field(Number, "quality")
	quality: number;

	@Field(Number, "smoothing")
	smoothing: number;

	@Field(Number, "focus")
	focus: number;

	@Field(Number, "spread")
	spread: number;

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
//#region Visualizer configuration
export class VisualizerConfiguration extends Model {
	@Field(Number, "rate")
	rate: number;

	@Field(Boolean, "autocorrect")
	autocorrect: boolean;

	@Field(String, "visualization")
	visualization: string;

	@Field(RecordOf(VisualizationConfiguration), "attachments")
	attachments: Map<string, VisualizationConfiguration>;

	constructor();
	constructor(rate: number, autocorrect: boolean, visualization: string, attachments: Map<string, VisualizationConfiguration>);
	constructor(rate?: number, autocorrect?: boolean, visualization?: string, attachments?: Map<string, VisualizationConfiguration>) {
		if (rate === undefined || autocorrect === undefined || visualization === undefined || attachments === undefined) {
			super();
			return;
		}

		super();
		this.rate = rate;
		this.autocorrect = autocorrect;
		this.visualization = visualization;
		this.attachments = attachments;
	}

	get configuration(): VisualizationConfiguration {
		let config = this.attachments.get(this.visualization);
		if (config === undefined) {
			config = new VisualizationConfiguration(10, 0.8, -60, 30);
			this.attachments.set(this.visualization, config);
		}
		return config;
	}
}
//#endregion
//#region Settings
export class Settings extends Model {
	@Field(Boolean, "is_opened_configurator")
	isOpenedConfigurator: boolean;

	@Field(VisualizerConfiguration, "visualizer")
	visualizer: VisualizerConfiguration;

	constructor();
	constructor(isOpenedConfigurator: boolean, visualizer: VisualizerConfiguration);
	constructor(isOpenedConfigurator?: boolean, visualizer?: VisualizerConfiguration) {
		if (isOpenedConfigurator === undefined || visualizer === undefined) {
			super();
			return;
		}
		super();
		this.isOpenedConfigurator = isOpenedConfigurator;
		this.visualizer = visualizer;
	}

	static get newDefault(): Settings {
		const configuration = new VisualizationConfiguration(10, 0.8, -60, 30);
		const visualization = ReferenceError.suppress(Visualizer.visualizations.at(0), "No any visualizations found");
		const attachments = new Map(Visualizer.visualizations.map(name => [name, configuration]));
		const visualizer = new VisualizerConfiguration(120, false, visualization, attachments);
		return new Settings(false, visualizer);
	}
}
//#endregion
