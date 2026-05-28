"use strict";

import "adaptive-extender/web";
import { type Model } from "adaptive-extender/web";
import { SessionCollector } from "../controllers/session-collector.js";
import { SessionIdentity } from "../models/session-identity.js";

//#region Analytics service
declare global {
	export interface Window {
		dataLayer: any[];
		gtag(...args: any[]): void;
	}
}

window.dataLayer ??= [];

window.gtag = function (): void {
	window.dataLayer.push(arguments);
};

export class AnalyticsService {
	static #lock: boolean = true;
	static #instance: AnalyticsService | null = null;
	#session: SessionCollector = new SessionCollector();

	constructor(id: string) {
		if (AnalyticsService.#lock) throw new TypeError("Illegal constructor");

		const session = this.#session;
		const identity = new SessionIdentity(session.userFingerprint, session.sessionFingerprint);
		const exported = SessionIdentity.export(identity);
		window.gtag("js", new Date());
		window.gtag("config", id, exported);
		window.gtag("set", exported);

		const script = document.createElement("script");
		script.async = true;
		script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
		document.head.appendChild(script);
	}

	static get instance(): AnalyticsService {
		if (AnalyticsService.#instance === null) {
			AnalyticsService.#lock = false;
			AnalyticsService.#instance = new AnalyticsService("G-1N3MKL65T7");
			AnalyticsService.#lock = true;
		}
		return AnalyticsService.#instance;
	}

	#event(name: string, params: object): void {
		const session = this.#session;
		const identity = new SessionIdentity(session.userFingerprint, session.sessionFingerprint);
		window.gtag("event", name, Object.assign(SessionIdentity.export(identity), params));
	}

	dispatch(name: string): void;
	dispatch(name: string, instance: Model): void;
	dispatch(name: string, instance?: Model): void {
		if (instance === undefined) return this.#event(name, {});
		return this.#event(name, (constructor(instance) as typeof Model).export(instance));
	}

	setProperties(instance: Model): void {
		window.gtag("set", "user_properties", (constructor(instance) as typeof Model).export(instance));
	}
}

export const analytics = AnalyticsService.instance;
//#endregion
