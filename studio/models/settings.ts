"use strict";

import "adaptive-extender/core";
import { Model, Field, Optional, Enum } from "adaptive-extender/core";
import { Registry } from "../services/visualization-registry.js";
import { Playlist } from "./playlist.js";

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
}
//#endregion
//#region Settings
export enum Panel {
	none = "none",
	playlist = "playlist",
	configurator = "configurator",
}

export class Settings extends Model {
	@Field(Enum.Of(Panel), { name: "panel" })
	panel: Panel = Panel.none;

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

	@Field(Playlist, { name: "playlist" })
	playlist: Playlist = new Playlist();

	get configuration(): VisualizationSettings {
		return ReferenceError.suppress(this.attachments.get(this.visualization), `Missing configurations for visualization '${this.visualization}'`);
	}

	reconcile(): void {
		const names = new Set(Registry.names());
		for (const name of this.attachments.keys()) this.attachments.delete(name);
		for (const name of names) this.attachments.add(name, new VisualizationSettings());
		if (!Registry.has(this.visualization)) this.visualization = Registry.default;
	}
}
//#endregion
