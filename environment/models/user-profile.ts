"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region User profile
export class UserProfile extends Model {
	/** CPU instruction-set architecture (e.g. "x86_64", "arm64", "arm", "x86"). Resolved from UA-CH getHighEntropyValues → userAgent token parsing. Worst-case "unknown". */
	@Field(String, { name: "cpu_architecture" })
	cpuArchitecture: string;

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
	pointer: string;

	/** navigator.doNotTrack resolved to a readable string. "enabled" when DNT is on, "disabled" when explicitly off, "unspecified" when the browser does not expose a value or the user has not set a preference. */
	@Field(String, { name: "do_not_track" })
	doNotTrack: string;

	/** screen.width and screen.height in CSS pixels, formatted as "1920x1080". Stable per device, so it helps recognise the same device after its visitor id was reset. */
	@Field(String, { name: "screen_resolution" })
	resolution: string;

	/** IANA time zone the device is set to (e.g. "Asia/Yerevan"), from Intl.DateTimeFormat().resolvedOptions(). Independent of IP geolocation, so it survives VPNs and datacenter egress. */
	@Field(String, { name: "time_zone" })
	timezone: string;

	/** true when the page runs as an installed app (display-mode: standalone). */
	@Field(Boolean, { name: "standalone" })
	standalone: boolean;

	/** navigator.webdriver — true when the browser is driven by automation (Selenium, Puppeteer, Playwright, headless crawlers). */
	@Field(Boolean, { name: "webdriver" })
	webdriver: boolean;

	constructor();
	constructor(cpuArchitecture: string, cpuCores: number, memoryGigabytes: number | undefined, maxTouchPoints: number, pixelRatio: number, bitDepth: number, darkMode: boolean, lowMotion: boolean, highContrast: boolean, pointer: string, doNotTrack: string, resolution: string, timezone: string, standalone: boolean, webdriver: boolean);
	constructor(cpuArchitecture?: string, cpuCores?: number, memoryGigabytes?: number, maxTouchPoints?: number, pixelRatio?: number, bitDepth?: number, darkMode?: boolean, lowMotion?: boolean, highContrast?: boolean, pointer?: string, doNotTrack?: string, resolution?: string, timezone?: string, standalone?: boolean, webdriver?: boolean) {
		if (cpuArchitecture === undefined || cpuCores === undefined || maxTouchPoints === undefined || pixelRatio === undefined || bitDepth === undefined || darkMode === undefined || lowMotion === undefined || highContrast === undefined || pointer === undefined || doNotTrack === undefined || resolution === undefined || timezone === undefined || standalone === undefined || webdriver === undefined) {
			super();
			return;
		}

		super();
		this.cpuArchitecture = cpuArchitecture;
		this.cpuCores = cpuCores;
		this.memoryGigabytes = memoryGigabytes;
		this.maxTouchPoints = maxTouchPoints;
		this.pixelRatio = pixelRatio;
		this.bitDepth = bitDepth;
		this.darkMode = darkMode;
		this.lowMotion = lowMotion;
		this.highContrast = highContrast;
		this.pointer = pointer;
		this.doNotTrack = doNotTrack;
		this.resolution = resolution;
		this.timezone = timezone;
		this.standalone = standalone;
		this.webdriver = webdriver;
	}
}
//#endregion
