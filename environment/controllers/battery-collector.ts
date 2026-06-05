"use strict";

import "adaptive-extender/web";
import { BatteryContext } from "../models/battery-context.js";
import { analytics } from "../services/analytics-service.js";
import { Controller } from "adaptive-extender/web";

const { round } = Math;

//#region Battery collector
declare global {
	export interface BatteryManager extends EventTarget {
		level: number;
		charging: boolean;
		chargingTime: number;
		dischargingTime: number;
	}

	export interface Navigator {
		getBattery?(): Promise<BatteryManager>;
	}
}

export class BatteryCollector extends Controller {
	async run(): Promise<void> {
		if (!navigator.getBattery) return;
		const battery = await navigator.getBattery();
		this.#update(battery);
		battery.addEventListener("levelchange", event => this.#update(battery));
		battery.addEventListener("chargingchange", event => this.#update(battery));
	}

	#update(battery: BatteryManager): void {
		const batteryLevel = round(battery.level * 100);
		analytics.setProperties(new BatteryContext(batteryLevel, battery.charging));
	}

	async catch(error: Error): Promise<void> {
		console.error(`Battery API failed:\n${error}`);
	}
}
//#endregion
