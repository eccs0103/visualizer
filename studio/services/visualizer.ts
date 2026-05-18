"use strict";

import "adaptive-extender/web";
import { type Engine, FastEngine } from "adaptive-extender/web";
import { Audioset, type AudiosetManager } from "../models/audioset.js";
import { AudioAnalyzer } from "./audio-analyzer.js";
import { type AudioFeatures } from "../models/audio-features.js";

const { round } = Math;

//#region Visualizer
export interface VisualizerEventMap {
	"update": Event;
	"rebuild": Event;
}

export interface VisualizationBundle {
	get context(): CanvasRenderingContext2D;
	get audioset(): Audioset;
	get features(): AudioFeatures;
	get isLaunched(): boolean;
	get delta(): number;
	get fps(): number;
	rebuild(): void;
	update(): void;
}

export interface VisualizationDescriptor {
	new(): VisualizationBundle;
}

export class Visualizer extends EventTarget {
	//#region Visualization
	static #Visualization: VisualizationDescriptor = class Visualization implements VisualizationBundle {
		#visualizer: Visualizer;

		constructor() {
			if (new.target === Visualization) throw new TypeError("Unable to create an instance of an abstract class");
			if (Visualizer.#ownerVisualization === null) throw new TypeError("Illegal constructor");
			this.#visualizer = Visualizer.#ownerVisualization;
		}

		get context(): CanvasRenderingContext2D { return this.#visualizer.#context; }
		get audioset(): Audioset { return this.#visualizer.#manager.audioset; }
		get features(): AudioFeatures { return this.#visualizer.#analyzer.features; }
		get isLaunched(): boolean { return this.#visualizer.#engine.launched; }
		get delta(): number { return this.#visualizer.#engine.delta; }
		get fps(): number { return this.#visualizer.#engine.fps; }

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

	static #descriptors: Map<string, VisualizationDescriptor> = new Map();
	static #instances: Visualizer[] = [];
	static #targets: [number, number][] = [
		[-80, 20], // SILENCE
		[-60, 25], // SPEECH
		[-55, 30], // AMBIENT
		[-50, 35], // BUILDUP
		[-45, 35], // BEAT
		[-38, 40], // DROP
	];

	#engine: Engine;
	#canvas: HTMLCanvasElement;
	#context: CanvasRenderingContext2D;
	#manager: AudiosetManager;
	#analyzer: AudioAnalyzer;
	#bundles: Map<string, VisualizationBundle> = new Map();
	#selection: [string, VisualizationBundle];

	constructor(canvas: HTMLCanvasElement, media: HTMLMediaElement) {
		super();

		const descriptors = Visualizer.#descriptors;
		if (descriptors.size < 1) throw new Error("No visualization is attached to the visualizer");
		for (const [name, descriptor] of descriptors) {
			this.#addBundle(name, descriptor);
		}
		Visualizer.#instances.push(this);

		const engine = this.#engine = new FastEngine({ launch: !document.hidden });
		document.addEventListener("visibilitychange", event => engine.launched = !document.hidden);

		this.#canvas = canvas;
		this.#fixCanvasSize();
		window.addEventListener("resize", event => this.#fixCanvasSize());
		this.#context = ReferenceError.suppress(canvas.getContext("2d"), "Failed to acquire 2D rendering context");

		const manager = this.#manager = new Audioset.Manager(media);
		this.#analyzer = new AudioAnalyzer(manager.rate);
		engine.addEventListener("trigger", event => manager.refresh());

		this.#selection = Array.from(this.#bundles)[0];
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
		return Array.from(Visualizer.#descriptors, ([name]) => name);
	}

	get rate(): number {
		return round(this.#engine.limit);
	}

	set rate(value: number) {
		if (!Visualizer.checkRate(value)) return;
		this.#engine.limit = round(value);
	}

	get autocorrect(): boolean { return this.#manager.autocorrect; }
	set autocorrect(value: boolean) { this.#manager.autocorrect = value; }
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
		this.#clear();
		this.#rebuild();
	}

	get analyzer(): AudioAnalyzer { return this.#analyzer; }

	static attach(name: string, visualization: VisualizationDescriptor): void {
		const descriptors = Visualizer.#descriptors;
		if (descriptors.has(name)) throw new Error(`Visualization with name '${name}' already attached`);
		descriptors.set(name, visualization);
		for (const visualizer of Visualizer.#instances) {
			visualizer.#addBundle(name, visualization);
		}
	}

	#addBundle(name: string, descriptor: VisualizationDescriptor): void {
		Visualizer.#ownerVisualization = this;
		const bundle = new descriptor;
		Visualizer.#ownerVisualization = null;
		this.#bundles.set(name, bundle);
	}

	#fixCanvasSize(): void {
		const canvas = this.#canvas;
		const { width, height } = canvas.getBoundingClientRect();
		canvas.width = width;
		canvas.height = height;
	}
	#clear(): void {
		const [, visualization] = this.#selection;
		const { context } = visualization;
		context.reset();
		context.resetTransform();
	}

	#rebuild(): void {
		const [, visualization] = this.#selection;
		visualization.rebuild();
		visualization.update();
		this.dispatchEvent(new Event("rebuild"));
	}

	#update(): void {
		const analyzer = this.#analyzer;
		const manager = this.#manager;
		const { dspScene } = analyzer.features;
		analyzer.analyze(manager.audioset);
		if (manager.autocorrect && dspScene >= 0) {
			const [focus, spread] = Visualizer.#targets[dspScene];
			manager.focus += (focus - manager.focus) * 0.04;
			manager.spread += (spread - manager.spread) * 0.04;
		}
		const [, visualization] = this.#selection;
		visualization.update();
		this.dispatchEvent(new Event("update"));
	}

	static checkRate(value: number): boolean {
		if (!Number.isFinite(value)) return false;
		if (30 > value || value > 300) return false;
		if (value % 30 !== 0) return false;
		return true;
	}
}
//#endregion
