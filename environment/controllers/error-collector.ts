"use strict";

import "adaptive-extender/web";
import { JavaScriptError } from "../models/javascript-error.js";
import { analytics } from "../services/analytics-service.js";
import { Controller } from "adaptive-extender/web";

//#region Error collector
export class ErrorCollector extends Controller {
	async run(): Promise<void> {
		window.addEventListener("error", this.#onError.bind(this));
		window.addEventListener("unhandledrejection", this.#onReject.bind(this));
	}

	#onError(event: ErrorEvent): void {
		const errorMessage = event.message;
		const errorSource = event.filename.insteadEmpty(undefined);
		const errorLine = event.lineno.insteadZero(undefined);
		analytics.dispatch("js_error", new JavaScriptError(errorMessage, errorSource, errorLine));
	}

	#onReject(event: PromiseRejectionEvent): void {
		const errorMessage = Error.from(event.reason).message;
		analytics.dispatch("js_error", new JavaScriptError(errorMessage, undefined, undefined));
	}

	async catch(error: Error): Promise<void> {
		console.error(`Error collection failed:\n${error}`);
	}
}
//#endregion
