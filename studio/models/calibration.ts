"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Calibration
/**
 * Beat-detector constants and per-feature normalization stats, measured offline
 * against MUSDB18HQ — see resources/data/calibration.json. Never hand-edited.
 */
export interface CalibrationScheme {
	beat_threshold_multiplier: number;
	beat_min_gap: number;
	beat_flux_window: number;
	feature_mean: number[];
	feature_std: number[];
}

export class Calibration extends Model {
	@Field(Number, { name: "beat_threshold_multiplier" })
	multiplier: number = 1.5;

	@Field(Number, { name: "beat_min_gap" })
	minGap: number = 8;

	@Field(Number, { name: "beat_flux_window" })
	window: number = 43;

	@Field(Array.Of(Number), { name: "feature_mean" })
	means: number[] = [];

	@Field(Array.Of(Number), { name: "feature_std" })
	deviations: number[] = [];
}
//#endregion
