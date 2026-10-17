"use strict";

import "adaptive-extender/core";
import { Model, Field, Nullable } from "adaptive-extender/core";

//#region Splitter report
export interface SplitterReportScheme {
	splitter_model: string | null;
	splitter_device: string | null;
	splitter_ms: number | null;
	splitter_rate: number | null;
	splitter_slowed: boolean;
	splitter_reason: string | null;
	display_fps: number;
	software_rendering: boolean;
	recording: boolean;
}

export class SplitterReport extends Model {
	@Field(Nullable.Of(String), { name: "splitter_model" })
	model: string | null;

	@Field(Nullable.Of(String), { name: "splitter_device" })
	device: string | null;

	@Field(Nullable.Of(Number), { name: "splitter_ms" })
	milliseconds: number | null;

	@Field(Nullable.Of(Number), { name: "splitter_rate" })
	rate: number | null;

	@Field(Boolean, { name: "splitter_slowed" })
	slowed: boolean;

	@Field(Nullable.Of(String), { name: "splitter_reason" })
	reason: string | null;

	@Field(Number, { name: "display_fps" })
	fps: number;

	@Field(Boolean, { name: "software_rendering" })
	software: boolean;

	@Field(Boolean, { name: "recording" })
	recording: boolean;

	constructor();
	constructor(model: string | null, device: string | null, milliseconds: number | null, rate: number | null, slowed: boolean, reason: string | null, fps: number, software: boolean, recording: boolean);
	constructor(model?: string | null, device?: string | null, milliseconds?: number | null, rate?: number | null, slowed?: boolean, reason?: string | null, fps?: number, software?: boolean, recording?: boolean) {
		if (model === undefined || device === undefined || milliseconds === undefined || rate === undefined || slowed === undefined || reason === undefined || fps === undefined || software === undefined || recording === undefined) {
			super();
			return;
		}

		super();
		this.model = model;
		this.device = device;
		this.milliseconds = milliseconds;
		this.rate = rate;
		this.slowed = slowed;
		this.reason = reason;
		this.fps = fps;
		this.software = software;
		this.recording = recording;
	}
}
//#endregion
