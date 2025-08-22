"use strict";

import "adaptive-extender/web";
import { Engine, FastEngine } from "adaptive-extender/web";
import { Audioset, type AudiosetManager } from "./audioset.js";

const { round } = Math;

//#region Visualizer
interface VisualizerEventMap {
	update: Event;
	rebuild: Event;
}

interface VisualizerVisualization {
	get context(): CanvasRenderingContext2D;
	get audioset(): Audioset;
	get isLaunched(): boolean;
	get delta(): number;
	get fps(): number;
	rebuild(): void;
	update(): void;
}

interface VisualizerVisualizationConstructor {
	new(): VisualizerVisualization;
}

class Visualizer extends EventTarget {
	//#region Visualization
	static #Visualization: VisualizerVisualizationConstructor = class Visualization implements VisualizerVisualization {
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
	static get Visualization(): VisualizerVisualizationConstructor {
		return this.#Visualization;
	}

	static #ownerVisualization: Visualizer | null = null;
	static #newVisualization(visualizer: Visualizer, name: string): VisualizerVisualization {
		Visualizer.#ownerVisualization = visualizer;
		const attachments = Visualizer.#attachments;
		const visualization = Object.suppress(attachments.get(name), `Visualization with name '${name}' doesn't attached`);
		this.#attachment = [value, visualization];
		const self = new Visualizer.Visualization();
		Visualizer.#ownerVisualization = null;
		return self;
	}
	//#endregion

	static #attachments: Map<string, VisualizerVisualizationConstructor> = new Map();
	#engine: Engine;
	#canvas: HTMLCanvasElement;
	#context: CanvasRenderingContext2D;
	#manager: AudiosetManager;
	#attachment: [string, VisualizerVisualization];
	constructor(canvas: HTMLCanvasElement, media: HTMLMediaElement) {
		super();

		const engine = this.#engine = new FastEngine(true);
		document.addEventListener("visibilitychange", event => engine.launched = !document.hidden);

		this.#canvas = canvas;
		this.#fixCanvasSize();
		window.addEventListener("resize", event => this.#fixCanvasSize());
		this.#context = Object.suppress(canvas.getContext("2d"));

		Visualizer.#newVisualization(this);
		const manager = this.#manager = new Audioset.Manager(media);
		engine.addEventListener("trigger", event => manager.refresh());

		this.#attachment = Object.suppress(Array.from(Visualizer.#attachments).at(0), "No visualization is attached to the visualizer");
		this.#rebuild();
		window.addEventListener("resize", event => this.#rebuild());
		engine.addEventListener("trigger", event => this.#update());
	}
	#fixCanvasSize(): void {
		const canvas = this.#canvas;
		const { width, height } = canvas.getBoundingClientRect();
		canvas.width = width;
		canvas.height = height;
	}
	#clear(): void {
		const [, visualization] = this.#attachment;
		const { context } = visualization;
		context.reset();
		context.resetTransform();
	}
	#rebuild(): void {
		const [, visualization] = this.#attachment;
		visualization.rebuild();
		visualization.update();
		this.dispatchEvent(new Event("rebuild"));
	}
	#update(): void {
		const [, visualization] = this.#attachment;
		visualization.update();
		this.dispatchEvent(new Event("update"));
	}
	static attach(name: string, visualization: VisualizerVisualization): void {
		const attachments = Visualizer.#attachments;
		if (attachments.has(name)) throw new Error(`Visualization with name '${name}' already attached`);
		attachments.set(name, visualization);
	}
	static get defaultVisualization(): string {
		const result = Visualizer.#attachments.keys().next();
		if (result.done) throw new ReferenceError("Unable to find any attachment");
		return result.value;
	}
	static get visualizations(): string[] {
		return Array.from(Visualizer.#attachments.keys());
	}
	get visualization(): string {
		const [name] = this.#attachment;
		return name;
	}
	set visualization(value: string) {
		const visualization = Object.suppress(Visualizer.#attachments.get(value), `Visualization with name '${value}' doesn't attached`);
		this.#attachment = [value, visualization];
		this.#clear();
		this.#rebuild();
	}
	get rate(): number {
		return round(this.#engine.limit);
	}
	static checkRate(value: number): boolean {
		if (!Number.isFinite(value)) return false;
		if (30 > value || value > 300) return false;
		if (value % 30 !== 0) return false;
		return true;
	}
	set rate(value: number) {
		if (!Visualizer.checkRate(value)) return;
		this.#engine.limit = round(value);
	}
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







	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options: boolean | AddEventListenerOptions = false): void {
		return super.addEventListener(type, listener, options);
	}
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options: boolean | EventListenerOptions = false): void {
		return super.removeEventListener(type, listener, options);
	}


}
//#endregion

export { Visualizer };
