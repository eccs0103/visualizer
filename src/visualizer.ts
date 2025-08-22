"use strict";

import "adaptive-extender/web";
import { Engine, FastEngine } from "adaptive-extender/web";
import { Audioset, type AudiosetManager } from "./audioset.js";

const { round } = Math;

//#region Visualizer
interface VisualizerEventMap {
	"update": Event;
	"rebuild": Event;
}

interface VisualizationBundle {
	get context(): CanvasRenderingContext2D;
	get audioset(): Audioset;
	get isLaunched(): boolean;
	get delta(): number;
	get fps(): number;
	rebuild(): void;
	update(): void;
}

interface VisualizationDescriptor {
	new(): VisualizationBundle;
}

class Visualizer extends EventTarget {
	//#region Visualization
	static #Visualization: VisualizationDescriptor = class Visualization implements VisualizationBundle {
		#visualizer: Visualizer;
		constructor() {
			if (new.target === Visualization) throw new TypeError("Unable to create an instance of an abstract class");
			if (Visualizer.#ownerVisualization === null) throw new TypeError("Illegal constructor");
			this.#visualizer = Visualizer.#ownerVisualization;
		}
		get context(): CanvasRenderingContext2D {
			return this.#visualizer.#context;
		}
		get audioset(): Audioset {
			return this.#visualizer.#manager.audioset;
		}
		get isLaunched(): boolean {
			return this.#visualizer.#engine.launched;
		}
		get delta(): number {
			return this.#visualizer.#engine.delta;
		}
		get fps(): number {
			return this.#visualizer.#engine.fps;
		}
		rebuild(): void {
			return;
		}
		update(): void {
			return;
		}
	};
	static get Visualization(): VisualizationDescriptor {
		return this.#Visualization;
	}

	static #ownerVisualization: Visualizer | null = null;
	//#endregion

	static #descriptors: Map<string, VisualizationDescriptor> = new Map();
	static get visualizations(): string[] {
		return Array.from(Visualizer.#descriptors, ([name]) => name);
	}
	static #instances: Visualizer[] = [];
	#engine: Engine;
	get rate(): number {
		return round(this.#engine.limit);
	}
	set rate(value: number) {
		if (!Visualizer.checkRate(value)) return;
		this.#engine.limit = round(value);
	}
	#canvas: HTMLCanvasElement;
	#context: CanvasRenderingContext2D;
	#manager: AudiosetManager;
	get autocorrect(): boolean {
		return this.#manager.autocorrect;
	}
	set autocorrect(value: boolean) {
		this.#manager.autocorrect = value;
	}
	get quality(): number {
		return this.#manager.quality;
	}
	set quality(value: number) {
		this.#manager.quality = value;
	}
	get smoothing(): number {
		return this.#manager.smoothing;
	}
	set smoothing(value: number) {
		this.#manager.smoothing = value;
	}
	get focus(): number {
		return this.#manager.focus;
	}
	set focus(value: number) {
		this.#manager.focus = value;
	}
	get spread(): number {
		return this.#manager.spread;
	}
	set spread(value: number) {
		this.#manager.spread = value;
	}
	#bundles: Map<string, VisualizationBundle>;
	#selection: [string, VisualizationBundle];
	get visualization(): string {
		const [name] = this.#selection;
		return name;
	}
	set visualization(value: string) {
		const visualization = Object.suppress(this.#bundles.get(value), `Visualization with name '${value}' doesn't attached`);
		this.#selection = [value, visualization];
		this.#clear();
		this.#rebuild();
	}
	constructor(canvas: HTMLCanvasElement, media: HTMLMediaElement) {
		super();

		const descriptors = Visualizer.#descriptors;
		if (descriptors.size < 1) throw new Error("No visualization is attached to the visualizer");
		for (const [name, descriptor] of descriptors) {
			this.#addBundle(name, descriptor);
		}
		Visualizer.#instances.push(this);

		const engine = this.#engine = new FastEngine(true);
		document.addEventListener("visibilitychange", event => engine.launched = !document.hidden);

		this.#canvas = canvas;
		this.#fixCanvasSize();
		window.addEventListener("resize", event => this.#fixCanvasSize());
		this.#context = Object.suppress(canvas.getContext("2d"));

		const manager = this.#manager = new Audioset.Manager(media);
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

export type { VisualizerEventMap, VisualizationBundle, VisualizationDescriptor };
export { Visualizer };
