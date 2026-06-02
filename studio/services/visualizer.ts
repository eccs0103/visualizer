"use strict";

import "adaptive-extender/web";
import { type Engine, FastEngine, Color } from "adaptive-extender/web";
import { Scene, SceneDefinition } from "../models/audio-features.js";
import { Audioset, type AudiosetManager } from "../models/audioset.js";
import { AudioAnalyzer } from "./audio-analyzer.js";
import { type VisualizationEnvironment, type VisualizationBundle, type VisualizationDescriptor, type AudiosetView, type VisualizationHost, VisualizationRegistry } from "./visualization-registry.js";
import { RenderBridge } from "./render-bridge.js";
import { RenderCommand, RebuildRenderCommand } from "../models/render-commands.js";

const { round } = Math;
const { baseURI } = document;

//#region Visualizer
export interface VisualizerEventMap {
	"update": Event;
	"rebuild": Event;
}

export { type VisualizationEnvironment, type VisualizationBundle, type VisualizationDescriptor };

export interface VisualizerOptions {
	isDeveloper: boolean;
}

export class Visualizer extends EventTarget {
	//#region Visualization
	static #Environment = class Environment implements VisualizationEnvironment {
		#engine: Engine;

		constructor(engine: Engine) {
			this.#engine = engine;
		}

		get isLaunched(): boolean { return this.#engine.launched; }
		get delta(): number { return this.#engine.delta; }
		get fps(): number { return this.#engine.fps; }
		get colorBackground(): Color {
			return Color.parse(window.getComputedStyle(document.documentElement).getPropertyValue("--color-heavy-main"));
		}
	};

	static #Visualization: VisualizationDescriptor = class Visualization implements VisualizationBundle {
		#visualizer: Visualizer;

		constructor() {
			if (new.target === Visualization) throw new TypeError("Unable to create an instance of an abstract class");
			if (Visualizer.#ownerVisualization === null) throw new TypeError("Illegal constructor");
			this.#visualizer = Visualizer.#ownerVisualization;
		}

		get environment(): VisualizationEnvironment { return this.#visualizer.#environment; }
		get context(): OffscreenCanvasRenderingContext2D { return this.#visualizer.#context; }
		get audioset(): AudiosetView { return this.#visualizer.#manager.audioset; }

		rebuild(): void {
			return;
		}

		update(): void {
			return;
		}
	};

	static get Visualization(): VisualizationDescriptor { return this.#Visualization; }

	static #ownerVisualization: Visualizer | null = null;
	//#endregion

	static #instances: Visualizer[] = [];
	static #targets: Map<Scene, [number, number]> = new Map([
		[Scene.silence, [-80, 20]],
		[Scene.speech, [-60, 25]],
		[Scene.ambient, [-55, 30]],
		[Scene.buildup, [-50, 35]],
		[Scene.beat, [-45, 35]],
		[Scene.drop, [-38, 40]],
	]);

	#engine: Engine;
	#canvas: HTMLCanvasElement;
	#environment: VisualizationEnvironment;
	#context: OffscreenCanvasRenderingContext2D;
	#manager: AudiosetManager;
	#analyzer: AudioAnalyzer;
	#bundles: Map<string, VisualizationBundle> = new Map();
	#selection: [string, VisualizationBundle];
	#renderBridge: RenderBridge;
	#renderWorker: Worker;

	constructor(canvas: HTMLCanvasElement, media: HTMLMediaElement);
	constructor(canvas: HTMLCanvasElement, media: HTMLMediaElement, options: Partial<VisualizerOptions>);
	constructor(canvas: HTMLCanvasElement, media: HTMLMediaElement, options: Partial<VisualizerOptions> = {}) {
		super();

		let { isDeveloper } = options;
		isDeveloper ??= false;

		const names = VisualizationRegistry.names();
		if (names.length < 1) throw new Error("No visualization is attached to the visualizer");
		Visualizer.#instances.push(this);

		const engine = this.#engine = new FastEngine({ launch: !document.hidden });
		document.addEventListener("visibilitychange", event => engine.launched = !document.hidden);
		const environment = this.#environment = new Visualizer.#Environment(engine);

		this.#canvas = canvas;
		this.#fixCanvasSize();
		window.addEventListener("resize", event => this.#fixCanvasSize());

		const manager = this.#manager = new Audioset.Manager(media);
		this.#analyzer = new AudioAnalyzer(manager.rate, { isDeveloper });
		engine.addEventListener("trigger", event => manager.refresh());

		const visualizer = this;
		const mainHost: VisualizationHost = {
			get context(): OffscreenCanvasRenderingContext2D { return visualizer.#context; },
			get audioset(): AudiosetView { return visualizer.#manager.audioset; },
			get environment(): VisualizationEnvironment { return visualizer.#environment; },
		};
		for (const [name, descriptor] of VisualizationRegistry.entries()) {
			this.#bundles.set(name, VisualizationRegistry.createBundle(mainHost, descriptor));
		}
		this.#selection = Array.from(this.#bundles)[0];

		const bridge = this.#renderBridge = new RenderBridge();
		const worker = this.#renderWorker = new Worker(new URL("./controllers/visualization-worker.js", baseURI), { type: "module" });
		const offscreen = canvas.transferControlToOffscreen();
		worker.postMessage({ type: "initialize", sab: bridge.sab, canvas: offscreen }, [offscreen]);

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

	static get visualizations(): string[] {
		return VisualizationRegistry.names();
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

	get visualization(): string {
		const [name] = this.#selection;
		return name;
	}

	set visualization(value: string) {
		const visualization = ReferenceError.suppress(this.#bundles.get(value), `Visualization with name '${value}' is not attached`);
		this.#selection = [value, visualization];
		this.#rebuild();
	}

	get analyzer(): AudioAnalyzer { return this.#analyzer; }
	get isDeveloper(): boolean { return this.#analyzer.isDeveloper; }
	get audioset(): Audioset { return this.#manager.audioset; }

	static attach(name: string, visualization: VisualizationDescriptor): void {
		VisualizationRegistry.attach(name, visualization);
		for (const visualizer of Visualizer.#instances) {
			const visualizer2 = visualizer;
			const host: VisualizationHost = {
				get context(): OffscreenCanvasRenderingContext2D { return visualizer2.#context; },
				get audioset(): AudiosetView { return visualizer2.#manager.audioset; },
				get environment(): VisualizationEnvironment { return visualizer2.#environment; },
			};
			visualizer.#bundles.set(name, VisualizationRegistry.createBundle(host, visualization));
		}
	}

	#fixCanvasSize(): void {
		const canvas = this.#canvas;
		const { width, height } = canvas.getBoundingClientRect();
		canvas.width = width;
		canvas.height = height;
	}

	#rebuild(): void {
		const { width, height } = this.#canvas.getBoundingClientRect();
		const [vizName] = this.#selection;
		this.#renderWorker.postMessage(RenderCommand.export(new RebuildRenderCommand(width, height, vizName)));
		this.dispatchEvent(new Event("rebuild"));
	}

	#correct(): void {
		const manager = this.#manager;
		this.#analyzer.analyze(manager);
		const { dspScene } = manager.audioset;
		if (dspScene < 0) return;
		const target = Visualizer.#targets.get(SceneDefinition.fromIndex(dspScene));
		if (target === undefined) return;
		const [focus, spread] = target;
		manager.focus += (focus - manager.focus) * 0.04;
		manager.spread += (spread - manager.spread) * 0.04;
	}

	#update(): void {
		const manager = this.#manager;
		if (manager.autoCorrect) this.#correct();
		const { length, volume, amplitude, dataFrequency, dataTemporal } = manager.audioset;
		const color = this.#environment.colorBackground;
		this.#renderBridge.writeAudioset(length, volume, amplitude, dataFrequency, dataTemporal, color.hue, color.saturation, color.lightness);
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
