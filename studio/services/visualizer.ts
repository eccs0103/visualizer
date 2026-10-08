"use strict";

import "adaptive-extender/web";
import { FastEngine, Color, WebEngine } from "adaptive-extender/web";
import { AudiosetManager } from "./audioset-manager.js";
import { StemMasks } from "../models/audio-features.js";
import { Registry } from "./visualization-registry.js";
import { Command, InitializeMaskCommand, StatusMaskCommand, InitializeRenderCommand, TickCommand, RebuildRenderCommand, LyricsRenderCommand, ShakeRenderCommand, LayersRenderCommand, ImageRenderCommand } from "../models/commands.js";
import { type LayerSettings } from "../models/layer-settings.js";
import { type BackgroundSettings } from "../models/background-settings.js";

const { round } = Math;
const { baseURI } = document;

//#region Visualizer
export interface VisualizerEventMap {
	"update": Event;
	"rebuild": Event;
	"splitter": Event;
}

export class Visualizer extends EventTarget {
	static #tick = Command.export(new TickCommand());
	static #minRate: number = 30;
	static #maxRate: number = 1200;
	#worker: Worker = new Worker(new URL("./controllers/visualization-worker.js", baseURI), { type: "module" });
	#maskWorker: Worker = new Worker(new URL("./controllers/stem-mask-worker.js", baseURI), { type: "module" });
	#engine: WebEngine = new FastEngine();
	#visualization: string;
	#shake: number = 0.2;
	#canvas: HTMLCanvasElement;
	#manager: AudiosetManager;
	#splitter: StatusMaskCommand | null = null;

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
		const sabMask = StemMasks.createBuffer();
		const urlModel = new URL("../data/stem-mask/model.json", baseURI).toString();
		const maskWorker = this.#maskWorker;
		maskWorker.addEventListener("message", event => this.#onMaskMessage(event));
		maskWorker.postMessage(Command.export(new InitializeMaskCommand(sab, sabMask, urlModel)));

		const offscreen = canvas.transferControlToOffscreen();
		this.#worker.postMessage(Command.export(new InitializeRenderCommand(sab, sabMask, manager.sampleRate, offscreen)), [offscreen]);

		this.#rebuild();
		window.addEventListener("resize", event => this.#rebuild());
		engine.addEventListener("trigger", event => this.#update());

		const metaColorScheme = document.getElement(HTMLMetaElement, "meta[name=\"color-scheme\"]");
		const observer = new MutationObserver(mutations => this.#rebuild());
		observer.observe(metaColorScheme, { attributes: true, attributeFilter: ["content"] });
		window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", event => this.#rebuild());
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

	static get minRate(): number { return this.#minRate; }
	static get maxRate(): number { return this.#maxRate; }

	get rate(): number {
		return round(this.#engine.limit);
	}

	set rate(value: number) {
		if (!Number.isFinite(value)) throw new Error(`The rate ${value} must be a finite number`);
		value = value.snap(30).clamp(Visualizer.#minRate, Visualizer.#maxRate);
		this.#engine.limit = value;
	}

	get manager(): AudiosetManager { return this.#manager; }

	/** The splitter's last reported state; `null` while its model is still loading. */
	get splitter(): StatusMaskCommand | null { return this.#splitter; }

	get visualization(): string {
		return this.#visualization;
	}

	set visualization(value: string) {
		if (!Registry.has(value)) throw new Error(`Visualization with name '${value}' is not attached`);
		this.#visualization = value;
		this.#rebuild();
	}

	get shake(): number { return this.#shake; }

	set shake(value: number) {
		value = value.clamp(0, 1);
		this.#shake = value;
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

	#onMaskMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");
		if (!(command instanceof StatusMaskCommand)) return;
		this.#splitter = command;
		this.dispatchEvent(new Event("splitter"));
	}

	#update(): void {
		const tick = Visualizer.#tick;
		this.#manager.capture();
		this.#maskWorker.postMessage(tick);
		this.#worker.postMessage(tick);
		this.dispatchEvent(new Event("update"));
	}

	arrange(visualization: string, layers: readonly LayerSettings[], background: BackgroundSettings, lyrics: LayerSettings): void {
		if (!Registry.has(visualization)) throw new Error(`Visualization with name '${visualization}' is not attached`);
		this.#worker.postMessage(Command.export(new LayersRenderCommand(visualization, Array.from(layers), background, lyrics)));
	}

	setBackground(visualization: string, image: Blob | null): void {
		if (!Registry.has(visualization)) throw new Error(`Visualization with name '${visualization}' is not attached`);
		this.#worker.postMessage(Command.export(new ImageRenderCommand(visualization, image)));
	}

	updateLyrics(previous: string | null, current: string | null, next: string | null): void {
		this.#worker.postMessage(Command.export(new LyricsRenderCommand(previous, current, next)));
	}
}
//#endregion
