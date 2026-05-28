"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Battery context
export class BatteryContext extends Model {
	/** Battery charge as an integer percentage 0–100. Derived from BatteryManager.level × 100, rounded. */
	@Field(Number, "battery_level")
	batteryLevel: number;

	/** true when the device is currently plugged in and the battery is gaining charge. */
	@Field(Boolean, "battery_charging")
	batteryCharging: boolean;

	constructor();
	constructor(batteryLevel: number, batteryCharging: boolean);
	constructor(batteryLevel?: number, batteryCharging?: boolean) {
		if (batteryLevel === undefined || batteryCharging === undefined) {
			super();
			return;
		}

		super();
		this.batteryLevel = batteryLevel;
		this.batteryCharging = batteryCharging;
	}
}
//#endregion
