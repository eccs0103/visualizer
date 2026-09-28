"use strict";

import "adaptive-extender/web";
import { UserProfile } from "../models/user-profile.js";
import { SessionContext } from "../models/session-context.js";
import { AnalyticsService } from "../services/analytics-service.js";
import { Controller } from "adaptive-extender/web";

const analytics = AnalyticsService.instance;

//#region Profile collector
declare global {
	export interface UaBrand {
		brand: string;
		version: string;
	}

	export interface NavigatorUAData {
		brands: readonly UaBrand[];
		mobile: boolean;
		platform: string;
		getHighEntropyValues(hints: string[]): Promise<UADataValues>;
	}

	export interface UADataValues {
		architecture?: string;
		model?: string;
		platformVersion?: string;
		bitness?: string;
		fullVersionList?: readonly UaBrand[];
	}

	export interface NetworkInformation extends EventTarget {
		type?: string;
		effectiveType?: string;
		downlink?: number;
		rtt?: number;
		saveData?: boolean;
	}

	export interface Navigator {
		userAgentData?: NavigatorUAData;
		deviceMemory?: number;
		connection?: NetworkInformation;
	}
}

export class ProfileCollector extends Controller {
	async run(): Promise<void> {
		const data = await this.#resolveHighEntropy();
		const cpuArchitecture = this.#resolveArchitecture(data);
		const pointer = this.#resolvePointer();
		const doNotTrack = this.#resolveDoNotTrack();
		const { hardwareConcurrency, maxTouchPoints, deviceMemory, webdriver } = navigator;
		const darkMode = matchMedia("(prefers-color-scheme: dark)").matches;
		const lowMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
		const highContrast = matchMedia("(prefers-contrast: more)").matches;
		const standalone = matchMedia("(display-mode: standalone)").matches;
		const resolution = `${screen.width}x${screen.height}`;
		const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
		analytics.setProperties(new UserProfile(cpuArchitecture, hardwareConcurrency, deviceMemory, maxTouchPoints, devicePixelRatio, screen.colorDepth, darkMode, lowMotion, highContrast, pointer, doNotTrack, resolution, timeZone, standalone, webdriver));
		this.#dispatchSessionContext();
	}

	static #nonEmpty(text: string | undefined): string | undefined {
		if (text === undefined) return undefined;
		return text.insteadEmpty(undefined);
	}

	async #resolveHighEntropy(): Promise<UADataValues> {
		const uad = navigator.userAgentData;
		if (uad === undefined) return {};
		try {
			return await uad.getHighEntropyValues(["architecture"]);
		} catch { /* fall through to UA string */ }
		return {};
	}

	#resolveArchitecture(data: UADataValues): string {
		const fallback = this.#fallbackArchitecture();
		const { architecture } = data;
		if (architecture === undefined) return fallback;
		return architecture.insteadEmpty(fallback);
	}

	#fallbackArchitecture(): string {
		const ua = navigator.userAgent;
		if (/Win64|WOW64/.test(ua)) return "x86_64";
		if (/x86_64|x64;/.test(ua)) return "x86_64";
		if (/aarch64|arm64/.test(ua)) return "arm64";
		if (/armv7l|armv8l/.test(ua)) return "arm";
		if (/Intel Mac OS X/.test(ua)) return "x86_64";
		if (/Win32/.test(ua)) return "x86";
		return "unknown";
	}

	#resolvePointer(): string {
		if (matchMedia("(pointer: fine)").matches) return "fine";
		if (matchMedia("(pointer: coarse)").matches) return "coarse";
		return "none";
	}

	#resolveDoNotTrack(): string {
		const raw = navigator.doNotTrack;
		if (raw === "1") return "enabled";
		if (raw === "0") return "disabled";
		return "unspecified";
	}

	#resolveDomain(urlReferrer: string): string {
		if (urlReferrer === "direct") return "direct";
		try {
			return new URL(urlReferrer).hostname;
		} catch {
			return "unknown";
		}
	}

	#resolveNavigation(): string {
		const [entry] = performance.getEntriesByType("navigation");
		if (entry instanceof PerformanceNavigationTiming) return entry.type;
		return "navigate";
	}

	#dispatchSessionContext(): void {
		const rawReferrer = document.referrer;
		const urlReferrer = rawReferrer.insteadEmpty("direct");
		const domainReferrer = this.#resolveDomain(urlReferrer);
		const languages = navigator.languages.join(",");
		const typeNavigation = this.#resolveNavigation();
		const { connection } = navigator;
		let typeConnection: string | undefined;
		let effectiveConnection: string | undefined;
		let downlink: number | undefined;
		let roundTripTimeMs: number | undefined;
		let dataSaver: boolean | undefined;
		if (connection !== undefined) {
			typeConnection = ProfileCollector.#nonEmpty(connection.type);
			effectiveConnection = ProfileCollector.#nonEmpty(connection.effectiveType);
			downlink = connection.downlink;
			roundTripTimeMs = connection.rtt;
			dataSaver = connection.saveData;
		}
		analytics.dispatch("session_context", new SessionContext(domainReferrer, typeNavigation, languages, typeConnection, effectiveConnection, downlink, roundTripTimeMs, dataSaver));
	}

	async catch(error: Error): Promise<void> {
		console.error(`Profile collection failed:\n${error}`);
	}
}
//#endregion
