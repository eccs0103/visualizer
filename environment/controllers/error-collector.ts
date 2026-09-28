"use strict";

import "adaptive-extender/web";
import { JavaScriptError } from "../models/javascript-error.js";
import { AnalyticsService } from "../services/analytics-service.js";
import { Controller } from "adaptive-extender/web";

const analytics = AnalyticsService.instance;

//#region Error collector
export class ErrorCollector extends Controller {
	#sent: Set<string> = new Set();

	async run(): Promise<void> {
		window.addEventListener("error", this.#onError.bind(this));
		window.addEventListener("unhandledrejection", this.#onReject.bind(this));
	}

	#onError(event: ErrorEvent): void {
		const { message } = event;
		const source = event.filename.insteadEmpty(undefined);
		const line = event.lineno.insteadZero(undefined);
		this.#report(new JavaScriptError(message, source, line));
	}

	#onReject(event: PromiseRejectionEvent): void {
		const { message } = Error.from(event.reason);
		this.#report(new JavaScriptError(message, undefined, undefined));
	}

	#report(error: JavaScriptError): void {
		const sent = this.#sent;
		const { message } = error;
		if (sent.has(message)) return;
		sent.add(message);
		analytics.dispatch("js_error", error);
	}

	async catch(error: Error): Promise<void> {
		console.error(`Error collection failed:\n${error}`);
	}
}
//#endregion
