"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region User profile
export interface UserProfileScheme {
	cpu_architecture: string;
	cpu_cores: number;
	memory_gigabytes: number | undefined;
	max_touch_points: number;
	pixel_ratio: number;
	bit_depth: number;
	dark_mode: boolean;
	low_motion: boolean;
	high_contrast: boolean;
	pointer_type: string;
	do_not_track: string;
	screen_resolution: string;
	time_zone: string;
	standalone: boolean;
	webdriver: boolean;
}

export class UserProfile extends Model {
	@Field(String, { name: "cpu_architecture" })
	cpuArchitecture: string;

	@Field(Number, { name: "cpu_cores" })
	cpuCores: number;

	@Field(Optional.Of(Number), { name: "memory_gigabytes" })
	memoryGigabytes: number | undefined;

	@Field(Number, { name: "max_touch_points" })
	maxTouchPoints: number;

	@Field(Number, { name: "pixel_ratio" })
	pixelRatio: number;

	@Field(Number, { name: "bit_depth" })
	bitDepth: number;

	@Field(Boolean, { name: "dark_mode" })
	darkMode: boolean;

	@Field(Boolean, { name: "low_motion" })
	lowMotion: boolean;

	@Field(Boolean, { name: "high_contrast" })
	highContrast: boolean;

	@Field(String, { name: "pointer_type" })
	pointer: string;

	@Field(String, { name: "do_not_track" })
	doNotTrack: string;

	@Field(String, { name: "screen_resolution" })
	resolution: string;

	@Field(String, { name: "time_zone" })
	timezone: string;

	@Field(Boolean, { name: "standalone" })
	standalone: boolean;

	@Field(Boolean, { name: "webdriver" })
	webdriver: boolean;

	constructor();
	constructor(cpuArchitecture: string, cpuCores: number, memoryGigabytes: number | undefined, maxTouchPoints: number, pixelRatio: number, bitDepth: number, darkMode: boolean, lowMotion: boolean, highContrast: boolean, pointer: string, doNotTrack: string, resolution: string, timezone: string, standalone: boolean, webdriver: boolean);
	constructor(cpuArchitecture?: string, cpuCores?: number, memoryGigabytes?: number, maxTouchPoints?: number, pixelRatio?: number, bitDepth?: number, darkMode?: boolean, lowMotion?: boolean, highContrast?: boolean, pointer?: string, doNotTrack?: string, resolution?: string, timezone?: string, standalone?: boolean, webdriver?: boolean) {
		if (cpuArchitecture === undefined || cpuCores === undefined || maxTouchPoints === undefined || pixelRatio === undefined || bitDepth === undefined || darkMode === undefined || lowMotion === undefined || highContrast === undefined || pointer === undefined || doNotTrack === undefined || resolution === undefined || timezone === undefined || standalone === undefined || webdriver === undefined) {
			super();
			return;
		}

		super();
		this.cpuArchitecture = cpuArchitecture;
		this.cpuCores = cpuCores;
		this.memoryGigabytes = memoryGigabytes;
		this.maxTouchPoints = maxTouchPoints;
		this.pixelRatio = pixelRatio;
		this.bitDepth = bitDepth;
		this.darkMode = darkMode;
		this.lowMotion = lowMotion;
		this.highContrast = highContrast;
		this.pointer = pointer;
		this.doNotTrack = doNotTrack;
		this.resolution = resolution;
		this.timezone = timezone;
		this.standalone = standalone;
		this.webdriver = webdriver;
	}
}
//#endregion
