"use strict";

import "adaptive-extender/web";
import { UserProfile } from "../models/user-profile.js";
import { SessionContext } from "../models/session-context.js";
import { analytics } from "../services/analytics-service.js";
import { Controller } from "adaptive-extender/web";

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
		const platform = await this.#resolvePlatform();
		const isMobile = this.#resolveMobile();
		const { cpuArchitecture, deviceModel } = await this.#resolveHighEntropy();
		const pointerType = this.#resolvePointerType();
		const primaryLanguage = navigator.languages[0] ?? navigator.language;
		const doNotTrack = this.#resolveDoNotTrack();
		const { hardwareConcurrency, maxTouchPoints, deviceMemory } = navigator;
		const darkMode = matchMedia("(prefers-color-scheme: dark)").matches;
		const lowMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
		const highContrast = matchMedia("(prefers-contrast: more)").matches;
		analytics.setProperties(new UserProfile(platform, isMobile, cpuArchitecture, deviceModel, hardwareConcurrency, deviceMemory, maxTouchPoints, devicePixelRatio, screen.colorDepth, darkMode, lowMotion, highContrast, pointerType, primaryLanguage, doNotTrack));
		this.#dispatchSessionContext();
	}

	async #resolvePlatform(): Promise<string> {
		const uad = navigator.userAgentData;
		const uadPlatform = uad?.platform.insteadEmpty(undefined);
		if (uadPlatform !== undefined) return uadPlatform;

		const raw = navigator.platform;
		if (raw === "Win32" || raw.startsWith("Win")) return "Windows";
		if (raw === "MacIntel" || raw.startsWith("Mac")) return "macOS";
		if (raw.includes("iPhone") || raw.includes("iPad")) return "iOS";
		if (raw.includes("Linux")) return navigator.userAgent.includes("Android") ? "Android" : "Linux";

		const ua = navigator.userAgent;
		if (ua.includes("Android")) return "Android";
		if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
		if (ua.includes("Windows")) return "Windows";
		if (ua.includes("CrOS")) return "ChromeOS";
		if (ua.includes("Mac OS")) return "macOS";
		if (ua.includes("Linux")) return "Linux";

		return raw.insteadEmpty("unknown");
	}

	#resolveMobile(): boolean {
		const uad = navigator.userAgentData;
		if (uad !== undefined) return uad.mobile;
		return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
	}

	async #resolveHighEntropy(): Promise<{ cpuArchitecture: string; deviceModel: string | undefined; }> {
		const uad = navigator.userAgentData;
		if (uad !== undefined) {
			try {
				const data = await uad.getHighEntropyValues(["architecture", "model"]);
				const cpuArchitecture = data.architecture?.insteadEmpty(undefined) ?? this.#fallbackArchitecture();
				const deviceModel = data.model?.insteadEmpty(undefined);
				return { cpuArchitecture, deviceModel };
			} catch { /* fall through to UA string */ }
		}
		return { cpuArchitecture: this.#fallbackArchitecture(), deviceModel: undefined };
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

	#resolvePointerType(): string {
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

	#dispatchSessionContext(): void {
		const rawReferrer = document.referrer;
		const referrerUrl = rawReferrer.insteadEmpty("direct");
		let referrerDomain: string;
		if (referrerUrl === "direct") {
			referrerDomain = "direct";
		} else {
			try {
				referrerDomain = new URL(referrerUrl).hostname;
			} catch {
				referrerDomain = "unknown";
			}
		}

		const allLanguages = navigator.languages.join(",");
		const [navEntry] = performance.getEntriesByType("navigation");
		const navigationType = navEntry instanceof PerformanceNavigationTiming ? navEntry.type : "navigate";
		const { connection } = navigator;
		const connectionType = connection?.type?.insteadEmpty(undefined);
		const effectiveConnection = connection?.effectiveType?.insteadEmpty(undefined);
		const downlinkMbps = connection?.downlink;
		const roundTripTimeMs = connection?.rtt;
		const dataSaverEnabled = connection?.saveData;
		const params = new URLSearchParams(location.search);
		const utmSource = params.get("utm_source")?.insteadEmpty(undefined);
		const utmMedium = params.get("utm_medium")?.insteadEmpty(undefined);
		const utmCampaign = params.get("utm_campaign")?.insteadEmpty(undefined);
		analytics.dispatch("session_context", new SessionContext(referrerUrl, referrerDomain, navigationType, allLanguages, connectionType, effectiveConnection, downlinkMbps, roundTripTimeMs, dataSaverEnabled, utmSource, utmMedium, utmCampaign));
	}

	async catch(error: Error): Promise<void> {
		console.error(`Profile collection failed:\n${error}`);
	}
}
//#endregion
