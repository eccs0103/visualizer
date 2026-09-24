"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Battery context
export class BatteryContext extends Model {
	/** Battery charge as an integer percentage 0–100. Derived from BatteryManager.level × 100, rounded. */
	@Field(Number, { name: "battery_level" })
	level: number;

	/** true when the device is currently plugged in and the battery is gaining charge. */
	@Field(Boolean, { name: "battery_charging" })
	charging: boolean;

	constructor();
	constructor(level: number, charging: boolean);
	constructor(level?: number, charging?: boolean) {
		if (level === undefined || charging === undefined) {
			super();
			return;
		}

		super();
		this.level = level;
		this.charging = charging;
	}
}
//#endregion
