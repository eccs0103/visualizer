"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { ProfileCollector } from "./profile-collector.js";
import { BatteryCollector } from "./battery-collector.js";
import { WebVitalsCollector } from "./web-vitals-collector.js";
import { EngagementCollector } from "./engagement-collector.js";
import { InteractionCollector } from "./interaction-collector.js";
import { ErrorCollector } from "./error-collector.js";

//#region Analytics controller
export class AnalyticsController extends Controller {
	async run(): Promise<void> {
		const promiseProfile = ProfileCollector.launch();
		const promiseBattery = BatteryCollector.launch();
		const promiseWebVitals = WebVitalsCollector.launch();
		const promiseEngagement = EngagementCollector.launch();
		const promiseInteraction = InteractionCollector.launch();
		const promiseError = ErrorCollector.launch();

		await Promise.all([promiseProfile, promiseBattery, promiseWebVitals, promiseEngagement, promiseInteraction, promiseError]);
	}

	async catch(error: Error): Promise<void> {
		console.error(`Analytics collection failed:\n${error}`);
	}
}
//#endregion
