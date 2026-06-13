"use strict";

import "adaptive-extender/web";
import { FastEngine, Color, WebEngine } from "adaptive-extender/web";
import { Audioset, type AudiosetManager } from "../models/audioset.js";
import { AudioAnalyzer } from "./audio-analyzer.js";
import { type VisualizationEnvironment } from "../models/visualization.js";
import { Registry } from "./visualization-registry.js";
import { RenderBridge } from "./render-bridge.js";
import { RenderCommand, InitializeRenderCommand, TickCommand, RebuildRenderCommand } from "../models/render-commands.js";

const { round } = Math;
const { baseURI } = document;

//#region Visualizer
export interface VisualizerEventMap {
	"update": Event;
	"rebuild": Event;
}

export interface VisualizerOptions {
	isDeveloper: boolean;
}

export class Visualizer extends EventTarget {
	//#region Visualization
	static #Environment = class Environment implements VisualizationEnvironment {
		#engine: WebEngine;

		constructor(engine: WebEngine) {
			this.#engine = engine;
		}

		get isLaunched(): boolean { return this.#engine.launched; }
		get delta(): number { return this.#engine.delta; }
		get fps(): number { return this.#engine.fps; }

		get colorBackground(): Color {
			return Color.parse(window.getComputedStyle(document.documentElement).getPropertyValue("--color-heavy-main"));
		}
	};
	//#endregion


	#bridge: RenderBridge = new RenderBridge();
	#worker: Worker = new Worker(new URL("./controllers/visualization-worker.js", baseURI), { type: "module" });
	#engine: WebEngine = new FastEngine();
	#environment: VisualizationEnvironment = new Visualizer.#Environment(this.#engine);
	#visualization: string;
	#canvas: HTMLCanvasElement;
	#manager: AudiosetManager;
	#analyzer: AudioAnalyzer;

	constructor(canvas: HTMLCanvasElement, media: HTMLMediaElement);
	constructor(canvas: HTMLCanvasElement, media: HTMLMediaElement, options: Partial<VisualizerOptions>);
	constructor(canvas: HTMLCanvasElement, media: HTMLMediaElement, options: Partial<VisualizerOptions> = {}) {
		super();

		this.#visualization = Registry.default;

		let { isDeveloper } = options;
		isDeveloper ??= false;

		const engine = this.#engine;
		engine.launched = !document.hidden;
		document.addEventListener("visibilitychange", event => engine.launched = !document.hidden);

		this.#canvas = canvas;
		this.#fixCanvasSize();

		const manager = this.#manager = new Audioset.Manager(media);
		this.#analyzer = new AudioAnalyzer(manager.rate, { isDeveloper });
		engine.addEventListener("trigger", event => manager.refresh());

		const offscreen = canvas.transferControlToOffscreen();
		this.#worker.postMessage(RenderCommand.export(new InitializeRenderCommand(this.#bridge.sab, this.#analyzer.outSAB, offscreen)), [offscreen]);

		this.#rebuild();
		window.addEventListener("resize", event => this.#rebuild());
		engine.addEventListener("trigger", event => this.#update());
	}

	addEventListener<K extends keyof VisualizerEventMap>(type: K, listener: (this: Document, ev: VisualizerEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof VisualizerEventMap>(type: K, listener: (this: Document, ev: VisualizerEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		return super.removeEventListener(type, listener, options);
	}

	get rate(): number {
		return round(this.#engine.limit);
	}

	set rate(value: number) {
		if (!Visualizer.checkRate(value)) return;
		this.#engine.limit = round(value);
	}

	get autoCorrect(): boolean { return this.#manager.autoCorrect; }
	set autoCorrect(value: boolean) { this.#manager.autoCorrect = value; }
	get quality(): number { return this.#manager.quality; }
	set quality(value: number) { this.#manager.quality = value; }
	get smoothing(): number { return this.#manager.smoothing; }
	set smoothing(value: number) { this.#manager.smoothing = value; }
	get focus(): number { return this.#manager.focus; }
	set focus(value: number) { this.#manager.focus = value; }
	get spread(): number { return this.#manager.spread; }
	set spread(value: number) { this.#manager.spread = value; }
	get boost(): number { return this.#manager.boost; }
	set boost(value: number) { this.#manager.boost = value; }
	get tilt(): number { return this.#manager.tilt; }
	set tilt(value: number) { this.#manager.tilt = value; }
	get punch(): number { return this.#manager.punch; }
	set punch(value: number) { this.#manager.punch = value; }

	get visualization(): string {
		return this.#visualization;
	}

	set visualization(value: string) {
		if (!Registry.has(value)) throw new Error(`Visualization with name '${value}' is not attached`);
		this.#visualization = value;
		this.#rebuild();
	}

	get analyzer(): AudioAnalyzer { return this.#analyzer; }
	get isDeveloper(): boolean { return this.#analyzer.isDeveloper; }
	get audioset(): Audioset { return this.#manager.audioset; }

	#fixCanvasSize(): void {
		const canvas = this.#canvas;
		const { width, height } = canvas.getBoundingClientRect();
		canvas.width = width;
		canvas.height = height;
	}

	#rebuild(): void {
		const { width, height } = this.#canvas.getBoundingClientRect();
		this.#worker.postMessage(RenderCommand.export(new RebuildRenderCommand(width, height, this.#visualization)));
		this.dispatchEvent(new Event("rebuild"));
	}

	#correct(): void {
		const manager = this.#manager;
		this.#analyzer.analyze(manager);
		const { djFocus, djSpread, djBoost, djTilt, djPunch } = manager.audioset;
		const rate = 0.04;
		manager.focus += (djFocus - manager.focus) * rate;
		manager.spread += (djSpread - manager.spread) * rate;
		manager.boost += (djBoost - manager.boost) * rate;
		manager.tilt += (djTilt - manager.tilt) * rate;
		manager.punch += (djPunch - manager.punch) * rate;
	}

	#update(): void {
		const manager = this.#manager;
		if (manager.autoCorrect) this.#correct();
		const { length, volume, amplitude, dataFrequency, dataTemporal } = manager.audioset;
		const color = this.#environment.colorBackground;
		this.#bridge.writeAudioset(length, volume, amplitude, dataFrequency, dataTemporal, color.hue, color.saturation, color.lightness);
		this.#worker.postMessage(RenderCommand.export(new TickCommand()));
		this.dispatchEvent(new Event("update"));
	}

	static checkRate(value: number): boolean {
		if (!Number.isFinite(value)) return false;
		if (30 > value || value > 1200) return false;
		if (value % 30 !== 0) return false;
		return true;
	}
}
//#endregion
