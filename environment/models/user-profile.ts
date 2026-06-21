"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region User profile
export class UserProfile extends Model {
	/** Resolved OS name (e.g. "Windows", "macOS", "Android", "iOS", "Linux", "ChromeOS"). Resolved from UA-CH platform → navigator.platform mapping → userAgent parsing chain. */
	@Field(String, { name: "platform" })
	platform: string;

	/** true when the session is running on a mobile browser. Resolved from UA-CH mobile flag → userAgent mobile pattern match. Always a definitive boolean. */
	@Field(Boolean, { name: "is_mobile" })
	isMobile: boolean;

	/** CPU instruction-set architecture (e.g. "x86_64", "arm64", "arm", "x86"). Resolved from UA-CH getHighEntropyValues → userAgent token parsing. Worst-case "unknown". */
	@Field(String, { name: "cpu_architecture" })
	cpuArchitecture: string;

	/** Device model string (e.g. "Pixel 9 Pro", "SM-A546B"). Available on Android Chrome via UA-CH; absent on desktops, iOS, and Firefox/Safari. */
	@Field(Optional.Of(String), { name: "device_model" })
	deviceModel: string | undefined;

	/** Logical CPU core count (navigator.hardwareConcurrency). Firefox caps this at 2 to resist fingerprinting. */
	@Field(Number, { name: "cpu_cores" })
	cpuCores: number;

	/** navigator.deviceMemory in GiB (power-of-two bucket: 0.25–8). Absent in Firefox and Safari. */
	@Field(Optional.Of(Number), { name: "memory_gigabytes" })
	memoryGigabytes: number | undefined;

	/** navigator.maxTouchPoints — maximum simultaneous touch contacts the device supports. 0 on mouse-only desktops; ≥1 on any touch-capable device. */
	@Field(Number, { name: "max_touch_points" })
	maxTouchPoints: number;

	/** window.devicePixelRatio — physical-to-CSS pixel ratio. 2.0 on Retina/HiDPI; fractional values appear with custom Windows DPI scaling. */
	@Field(Number, { name: "pixel_ratio" })
	pixelRatio: number;

	/** screen.colorDepth in bits per component (typically 24 or 30). Lower values can indicate remote-desktop or HDR-limited sessions. */
	@Field(Number, { name: "bit_depth" })
	bitDepth: number;

	/** true when prefers-color-scheme: dark is active at the OS or browser level. */
	@Field(Boolean, { name: "dark_mode" })
	darkMode: boolean;

	/** true when prefers-reduced-motion: reduce is active in OS accessibility settings. */
	@Field(Boolean, { name: "low_motion" })
	lowMotion: boolean;

	/** true when prefers-contrast: more is active. Signals an accessibility need; rare on desktop and absent on most mobile devices. */
	@Field(Boolean, { name: "high_contrast" })
	highContrast: boolean;

	/** Primary pointer input method: "fine" (mouse or trackpad), "coarse" (touchscreen), "none" (keyboard-only or TV remote). */
	@Field(String, { name: "pointer_type" })
	pointerType: string;

	/** First (highest-priority) language tag from navigator.languages (e.g. "en-US", "ru"). Reflects the browser's UI language preference. */
	@Field(String, { name: "primary_language" })
	primaryLanguage: string;

	/** navigator.doNotTrack value: "enabled", "disabled", or "unspecified". */
	@Field(String, { name: "do_not_track" })
	doNotTrack: string;

	constructor();
	constructor(platform: string, isMobile: boolean, cpuArchitecture: string, deviceModel: string | undefined, cpuCores: number, memoryGigabytes: number | undefined, maxTouchPoints: number, pixelRatio: number, bitDepth: number, darkMode: boolean, lowMotion: boolean, highContrast: boolean, pointerType: string, primaryLanguage: string, doNotTrack: string);
	constructor(platform?: string, isMobile?: boolean, cpuArchitecture?: string, deviceModel?: string, cpuCores?: number, memoryGigabytes?: number, maxTouchPoints?: number, pixelRatio?: number, bitDepth?: number, darkMode?: boolean, lowMotion?: boolean, highContrast?: boolean, pointerType?: string, primaryLanguage?: string, doNotTrack?: string) {
		if (platform === undefined || isMobile === undefined || cpuArchitecture === undefined || cpuCores === undefined || maxTouchPoints === undefined || pixelRatio === undefined || bitDepth === undefined || darkMode === undefined || lowMotion === undefined || highContrast === undefined || pointerType === undefined || primaryLanguage === undefined || doNotTrack === undefined) {
			super();
			return;
		}

		super();
		this.platform = platform;
		this.isMobile = isMobile;
		this.cpuArchitecture = cpuArchitecture;
		this.deviceModel = deviceModel;
		this.cpuCores = cpuCores;
		this.memoryGigabytes = memoryGigabytes;
		this.maxTouchPoints = maxTouchPoints;
		this.pixelRatio = pixelRatio;
		this.bitDepth = bitDepth;
		this.darkMode = darkMode;
		this.lowMotion = lowMotion;
		this.highContrast = highContrast;
		this.pointerType = pointerType;
		this.primaryLanguage = primaryLanguage;
		this.doNotTrack = doNotTrack;
	}
}
//#endregion
