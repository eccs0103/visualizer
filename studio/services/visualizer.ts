"use strict";

import "adaptive-extender/web";
import { FastEngine, Color, WebEngine } from "adaptive-extender/web";
import { AudiosetManager } from "./audioset-manager.js";
import { Splitter } from "./splitter.js";
import { Registry } from "./visualization-registry.js";
import { Command, InitializeRenderCommand, TickCommand, RebuildRenderCommand, LyricsRenderCommand, ShakeRenderCommand, GainsRenderCommand, LayersRenderCommand, ImageRenderCommand } from "../models/commands.js";
import { type StemGains } from "../models/stem.js";
import { type LayerSettings, type BackgroundSettings } from "../models/layer-settings.js";

const { round } = Math;
const { baseURI } = document;

//#region Visualizer
export interface VisualizerEventMap {
	"update": Event;
	"rebuild": Event;
}

export class Visualizer extends EventTarget {
	static #minRate: number = 30;
	static #maxRate: number = 1200;
	static #depth: number = 2;
	static #renderers: RegExp = /SwiftShader|Basic Render/i;
	#accelerated: boolean = Visualizer.#detect();
	#worker: Worker = new Worker(new URL("./controllers/visualization-worker.js", baseURI), { type: "module" });
	#engine: WebEngine = new FastEngine();
	#visualization: string;
	#posted: number = 0;
	#fresh: boolean = false;
	#canvas: HTMLCanvasElement;
	#manager: AudiosetManager;
	#splitter: Splitter;

	constructor(canvas: HTMLCanvasElement, media: HTMLMediaElement) {
		super();

		this.#visualization = Registry.default;

		const engine = this.#engine;
		engine.launched = !document.hidden;
		document.addEventListener("visibilitychange", event => engine.launched = !document.hidden);

		this.#canvas = canvas;
		this.#fixCanvasSize();

		const manager = this.#manager = new AudiosetManager(media);
		const { sab } = manager.signal;
		const splitter = this.#splitter = new Splitter(sab);

		const offscreen = canvas.transferControlToOffscreen();
		this.#worker.postMessage(Command.export(new InitializeRenderCommand(sab, splitter.masks.sab, manager.sampleRate, offscreen)), [offscreen]);

		this.#rebuild();
		window.addEventListener("resize", event => this.#rebuild());
		engine.addEventListener("trigger", event => this.#update());

		const metaColorScheme = document.getElement(HTMLMetaElement, "meta[name=\"color-scheme\"]");
		const observer = new MutationObserver(mutations => this.#rebuild());
		observer.observe(metaColorScheme, { attributes: true, attributeFilter: ["content"] });
		window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", event => this.#rebuild());
	}

	addEventListener<K extends keyof VisualizerEventMap>(type: K, listener: (this: Visualizer, event: VisualizerEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof VisualizerEventMap>(type: K, listener: (this: Visualizer, event: VisualizerEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		return super.removeEventListener(type, listener, options);
	}

	static get minRate(): number { return this.#minRate; }
	static get maxRate(): number { return this.#maxRate; }

	get rate(): number {
		return round(this.#engine.limit);
	}

	set rate(value: number) {
		if (!Number.isFinite(value)) throw new ReferenceError(`The rate ${value} must be a finite number`);
		value = value.snap(30).clamp(Visualizer.#minRate, Visualizer.#maxRate);
		this.#engine.limit = value;
	}

	get interval(): number { return this.#engine.delta * 1000; }
	get fresh(): boolean { return this.#fresh; }
	get accelerated(): boolean { return this.#accelerated; }
	get manager(): AudiosetManager { return this.#manager; }
	get splitter(): Splitter { return this.#splitter; }

	static #detect(): boolean {
		const context = document.createElement("canvas").getContext("webgl");
		if (context === null) return false;
		try {
			const info = context.getExtension("WEBGL_debug_renderer_info");
			if (info === null) return true;
			return !Visualizer.#renderers.test(String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)));
		} finally {
			context.getExtension("WEBGL_lose_context")?.loseContext();
		}
	}

	weigh(gains: StemGains): void {
		this.#worker.postMessage(Command.export(new GainsRenderCommand(gains)));
	}

	get visualization(): string {
		return this.#visualization;
	}

	set visualization(value: string) {
		if (!Registry.has(value)) throw new ReferenceError(`Visualization with name '${value}' is not attached`);
		this.#visualization = value;
		this.#rebuild();
	}

	set shake(value: number) {
		value = value.clamp(0, 1);
		this.#worker.postMessage(Command.export(new ShakeRenderCommand(value)));
	}

	#fixCanvasSize(): void {
		const canvas = this.#canvas;
		const { width, height } = canvas.getBoundingClientRect();
		canvas.width = width;
		canvas.height = height;
	}

	#rebuild(): void {
		const color = Color.parse(window.getComputedStyle(document.documentElement).getPropertyValue("--color-heavy-main"));
		const { width, height } = this.#canvas.getBoundingClientRect();
		if (width === 0 || height === 0) return;
		this.#worker.postMessage(Command.export(new RebuildRenderCommand(width, height, this.#visualization, color.hue, color.saturation, color.lightness)));
		this.dispatchEvent(new Event("rebuild"));
	}

	#update(): void {
		const manager = this.#manager;
		const splitter = this.#splitter;
		manager.capture(splitter.model !== null);
		splitter.tick();
		const posted = this.#posted;
		const fresh = this.#fresh = ((posted - manager.signal.drawn) | 0) < Visualizer.#depth;
		if (fresh) {
			this.#posted = (posted + 1) | 0;
			this.#worker.postMessage(Command.export(new TickCommand()));
		}
		this.dispatchEvent(new Event("update"));
	}

	arrange(visualization: string, layers: readonly LayerSettings[], background: BackgroundSettings, lyrics: LayerSettings): void {
		if (!Registry.has(visualization)) throw new ReferenceError(`Visualization with name '${visualization}' is not attached`);
		this.#worker.postMessage(Command.export(new LayersRenderCommand(visualization, Array.from(layers), background, lyrics)));
	}

	setBackground(visualization: string, image: Blob | null): void {
		if (!Registry.has(visualization)) throw new ReferenceError(`Visualization with name '${visualization}' is not attached`);
		this.#worker.postMessage(Command.export(new ImageRenderCommand(visualization, image)));
	}

	updateLyrics(previous: string | null, current: string | null, next: string | null): void {
		this.#worker.postMessage(Command.export(new LyricsRenderCommand(previous, current, next)));
	}
}
//#endregion
