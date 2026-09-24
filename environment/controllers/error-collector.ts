"use strict";

import "adaptive-extender/web";
import { JavaScriptError } from "../models/javascript-error.js";
import { AnalyticsService } from "../services/analytics-service.js";
import { Controller } from "adaptive-extender/web";

const analytics = AnalyticsService.instance;

//#region Error collector
export class ErrorCollector extends Controller {
	async run(): Promise<void> {
		window.addEventListener("error", this.#onError.bind(this));
		window.addEventListener("unhandledrejection", this.#onReject.bind(this));
	}

	#onError(event: ErrorEvent): void {
		const { message } = event;
		const source = event.filename.insteadEmpty(undefined);
		const line = event.lineno.insteadZero(undefined);
		analytics.dispatch("js_error", new JavaScriptError(message, source, line));
	}

	#onReject(event: PromiseRejectionEvent): void {
		const { message } = Error.from(event.reason);
		analytics.dispatch("js_error", new JavaScriptError(message, undefined, undefined));
	}

	async catch(error: Error): Promise<void> {
		console.error(`Error collection failed:\n${error}`);
	}
}
//#endregion
