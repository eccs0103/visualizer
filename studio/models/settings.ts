"use strict";

import "adaptive-extender/core";
import { Model, Field, Optional, Enum } from "adaptive-extender/core";
import { Registry } from "../services/visualization-registry.js";
import { type Layer } from "../services/layers.js";
import { LayerSettings } from "./layer-settings.js";
import { EngineSettings } from "./engine-settings.js";
import { Playlist, type Reorder } from "./playlist.js";

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

	@Field(Array.Of(LayerSettings), { name: "layers" })
	layers: LayerSettings[] = [];

	reconcile(declared: readonly Layer[]): void {
		const kept: LayerSettings[] = [];
		for (const entry of this.layers) {
			if (!declared.some(layer => entry.matches(layer.name))) continue;
			if (kept.some(other => other.matches(entry.name))) continue;
			kept.push(entry);
		}
		for (const layer of declared) {
			if (kept.some(entry => entry.matches(layer.name))) continue;
			kept.push(LayerSettings.fromLayer(layer));
		}
		this.layers = kept;
	}

	move(reorder: Reorder): boolean {
		const { layers } = this;
		const { from, to } = reorder;
		if (from < 0 || from >= layers.length || to < 0 || to >= layers.length || from === to) return false;
		const [entry] = layers.splice(from, 1);
		layers.splice(to, 0, entry);
		return true;
	}
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
	rate: number = 120;

	@Field(Boolean, { name: "auto_correct" })
	autoCorrect: boolean = true;

	@Field(Optional.Of(Boolean), { name: "auto_train" })
	autoTrain: boolean | undefined;

	@Field(Boolean, { name: "lyrics" })
	lyrics: boolean = true;

	@Field(Boolean, { name: "lyrics_lookup" })
	lookup: boolean = true;

	@Field(Number, { name: "shake" })
	shake: number = 0.2;

	@Field(String, { name: "visualization" })
	visualization: string = Registry.default;

	@Field(EngineSettings, { name: "engine" })
	engine: EngineSettings = new EngineSettings();

	@Field(Map.AsRecord(VisualizationSettings), { name: "attachments" })
	attachments: Map<string, VisualizationSettings> = new Map(Array.from(Registry.names(), name => [name, new VisualizationSettings()]));

	@Field(Playlist, { name: "playlist" })
	playlist: Playlist = new Playlist();

	get configuration(): VisualizationSettings {
		return ReferenceError.suppress(this.attachments.get(this.visualization), `Missing configurations for visualization '${this.visualization}'`);
	}

	reconcile(): void {
		const names = new Set(Registry.names());
		for (const name of Array.from(this.attachments.keys())) if (!names.has(name)) this.attachments.delete(name);
		for (const name of names) if (!this.attachments.has(name)) this.attachments.add(name, new VisualizationSettings());
		for (const [name, attachment] of this.attachments) attachment.reconcile(Registry.layers(name));		if (!Registry.has(this.visualization)) this.visualization = Registry.default;
	}
}
//#endregion
