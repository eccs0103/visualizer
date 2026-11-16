"use strict";

import "adaptive-extender/web";
import { Model, URI } from "adaptive-extender/web";
import { SessionCollector } from "../controllers/session-collector.js";
import { SessionIdentity } from "../models/session-identity.js";
import { TrafficContext } from "../models/traffic-context.js";
import { CookieJar } from "./cookie-jar.js";

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

		const identity = this.#session.identity();
		const exported = SessionIdentity.export(identity);
		window.gtag("js", new Date());
		window.gtag("config", id, exported);
		window.gtag("set", exported);
		window.gtag("set", TrafficContext.export(AnalyticsService.#traffic()));

		const script = document.createElement("script");
		script.async = true;
		script.crossOrigin = "anonymous";
		const source = new URI("https://www.googletagmanager.com/gtag/js");
		source.searchParams.set("id", id);
		script.src = source.href;
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
	static #traffic(): TrafficContext {
		return new TrafficContext(AnalyticsService.#resolveTraffic(), AnalyticsService.#resolveNetwork());
	}

	static #resolveTraffic(): string | undefined {
		if (location.hostname !== "localhost") return undefined;
		return "internal";
	}

	static #resolveNetwork(): string | undefined {
		return CookieJar.read("_net") ?? undefined;
	}

	#event(name: string, params: object): void {
		const identity = this.#session.identity();
		const traffic = AnalyticsService.#traffic();
		window.gtag("event", name, Object.assign(SessionIdentity.export(identity), TrafficContext.export(traffic), params));
	}

	dispatch(name: string): void;
	dispatch(name: string, instance: Model): void;
	dispatch(name: string, instance?: Model): void {
		if (instance === undefined) return this.#event(name, {});
		return this.#event(name, Model.export.call(constructor(instance), instance));
	}

	setProperties(instance: Model): void {
		window.gtag("set", "user_properties", Model.export.call(constructor(instance), instance));
	}
}
//#endregion
