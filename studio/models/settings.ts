"use strict";

import "adaptive-extender/worker";
import { Model, Field, Enum, Optional } from "adaptive-extender/worker";
import { Registry } from "../services/visualization-registry.js";
import { type Layer } from "../services/layers.js";
import { LayerSettings, BackgroundEffectKind, BackgroundFit, BackgroundSettings, type LayerSettingsScheme, type BackgroundSettingsScheme } from "./layer-settings.js";
import { Blend } from "./blend.js";
import { Playlist, type PlaylistScheme } from "./playlist.js";
import { type Reorder } from "./reorder.js";

//#region Visualization settings
export interface VisualizationSettingsScheme {
	quality: number;
	smoothing: number;
	focus: number;
	spread: number;
	boost: number;
	tilt: number;
	punch: number;
	layers: LayerSettingsScheme[];
	background: BackgroundSettingsScheme;
	lyrics: LayerSettingsScheme;
}

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

	@Field(BackgroundSettings, { name: "background" })
	background: BackgroundSettings = new BackgroundSettings(1, Blend.normal, BackgroundFit.cover, null, BackgroundEffectKind.pulse, 0.5);

	@Field(LayerSettings, { name: "lyrics" })
	lyrics: LayerSettings = new LayerSettings("Lyrics", 1, Blend.normal);

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
		return reorder.apply(this.layers);
	}
}
//#endregion
//#region Settings
export enum Panel {
	none = "none",
	playlist = "playlist",
	configurator = "configurator",
}

export interface SettingsScheme {
	panel: Panel;
	rate: number;
	lyrics: boolean;
	lyrics_lookup: boolean;
	shake: number;
	visualization: string;
	attachments: Record<string, VisualizationSettingsScheme>;
}

export class Settings extends Model {
	@Field(Enum.Of(Panel), { name: "panel" })
	panel: Panel = Panel.none;

	@Field(Number, { name: "rate" })
	rate: number = 120;

	@Field(Boolean, { name: "lyrics" })
	lyrics: boolean = true;

	@Field(Boolean, { name: "lyrics_lookup" })
	lookup: boolean = true;

	@Field(Number, { name: "shake" })
	shake: number = 0.2;

	@Field(String, { name: "visualization" })
	visualization: string = Registry.default;

	@Field(Map.AsRecord(VisualizationSettings), { name: "attachments" })
	attachments: Map<string, VisualizationSettings> = new Map(Array.from(Registry.names(), name => [name, new VisualizationSettings()]));

	get configuration(): VisualizationSettings {
		return ReferenceError.suppress(this.attachments.get(this.visualization), `Missing configurations for visualization '${this.visualization}'`);
	}

	reconcile(): void {
		const names = new Set(Registry.names());
		for (const name of Array.from(this.attachments.keys())) if (!names.has(name)) this.attachments.delete(name);
		for (const name of names) if (!this.attachments.has(name)) this.attachments.add(name, new VisualizationSettings());
		for (const [name, attachment] of this.attachments) attachment.reconcile(Registry.layers(name));
		if (!Registry.has(this.visualization)) this.visualization = Registry.default;
	}
}
//#endregion
//#region Legacy settings
export interface LegacySettingsScheme {
	playlist: PlaylistScheme | undefined;
}

/**
 * Reads the playlist that the settings cell held before the playlist got its own cell.
 * @deprecated Migration only. Remove once no stored settings cell carries a playlist.
 */
export class LegacySettings extends Model {
	@Field(Optional.Of(Playlist), { name: "playlist" })
	playlist: Playlist | undefined = undefined;
}
//#endregion
