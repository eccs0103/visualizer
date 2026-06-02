"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { Color } from "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";
import { type AudiosetView, type VisualizationBundle, type VisualizationEnvironment, type VisualizationHost, VisualizationRegistry } from "../services/visualization-registry.js";
import { RenderCommand, RebuildRenderCommand } from "../models/render-commands.js";
import { RenderBridge } from "../services/render-bridge.js";
import "../view/visualizations.js";

//#region Visualization worker
class WorkerAudiosetView implements AudiosetView {
	#control: Int32Array;
	#metadata: Float32Array;
	#color: Float32Array;
	#frequency: Float32Array;
	#temporal: Float32Array;
	#length: number = 0;

	constructor(sab: SharedArrayBuffer) {
		this.#control = new Int32Array(sab, 0, 2);
		this.#metadata = new Float32Array(sab, 8, 2);
		this.#color = new Float32Array(sab, 16, 3);
		this.#frequency = new Float32Array(sab, RenderBridge.frequencyOffset(), SabLayout.inputMaxLength);
		this.#temporal = new Float32Array(sab, RenderBridge.temporalOffset(), SabLayout.inputMaxLength);
	}

	get control(): Int32Array { return this.#control; }
	get length(): number { return this.#length; }
	get volume(): number { return this.#metadata[0]; }
	get amplitude(): number { return this.#metadata[1]; }
	get dataFrequency(): Float32Array { return this.#frequency.subarray(0, this.#length); }
	get dataTemporal(): Float32Array { return this.#temporal.subarray(0, this.#length); }
	get colorH(): number { return this.#color[0]; }
	get colorS(): number { return this.#color[1]; }
	get colorL(): number { return this.#color[2]; }

	sync(): void {
		this.#length = Atomics.load(this.#control, 1);
	}
}

class WorkerEnvironment implements VisualizationEnvironment {
	#view: WorkerAudiosetView;
	#lastTime: number = NaN;
	#delta: number = NaN;

	constructor(view: WorkerAudiosetView) {
		this.#view = view;
	}

	tick(): void {
		const now = performance.now() / 1000;
		this.#delta = Number.isFinite(this.#lastTime) ? now - this.#lastTime : NaN;
		this.#lastTime = now;
	}

	get isLaunched(): boolean { return true; }
	get delta(): number { return this.#delta; }
	get fps(): number { return Number.isFinite(this.#delta) && this.#delta > 0 ? 1 / this.#delta : 0; }
	get colorBackground(): Color { return Color.fromHSL(this.#view.colorH, this.#view.colorS, this.#view.colorL); }
}

class VisualizationWorker extends Controller {
	#canvas: OffscreenCanvas | null = null;
	#context: OffscreenCanvasRenderingContext2D | null = null;
	#audiosetView: WorkerAudiosetView | null = null;
	#environment: WorkerEnvironment | null = null;
	#bundles: Map<string, VisualizationBundle> = new Map();
	#selection: [string, VisualizationBundle] | null = null;
	#lastFrame: number = -1;

	static #WorkerHost = class WorkerHost implements VisualizationHost {
		#worker: VisualizationWorker;

		constructor(worker: VisualizationWorker) {
			this.#worker = worker;
		}

		get context(): OffscreenCanvasRenderingContext2D { return this.#worker.#context!; }
		get audioset(): AudiosetView { return this.#worker.#audiosetView!; }
		get environment(): VisualizationEnvironment { return this.#worker.#environment!; }
	};

	#poll(): void {
		const audiosetView = this.#audiosetView;
		const selection = this.#selection;
		if (audiosetView === null || selection === null) return;

		const frame = Atomics.load(audiosetView.control, 0);
		if (frame === this.#lastFrame) return;
		this.#lastFrame = frame;

		audiosetView.sync();
		this.#environment!.tick();
		const [, bundle] = selection;
		bundle.update();
	}

	#onMessage(event: MessageEvent): void {
		const data = event.data;

		if (data?.type === "initialize") {
			const { sab, canvas } = data as { sab: SharedArrayBuffer; canvas: OffscreenCanvas; };
			this.#canvas = canvas;
			this.#context = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
			const view = this.#audiosetView = new WorkerAudiosetView(sab);
			this.#environment = new WorkerEnvironment(view);
			const host = new VisualizationWorker.#WorkerHost(this);
			for (const [name, descriptor] of VisualizationRegistry.entries()) {
				this.#bundles.set(name, VisualizationRegistry.createBundle(host, descriptor));
			}
			this.#selection = Array.from(this.#bundles)[0] ?? null;
			return;
		}

		const command = RenderCommand.import(data, "command");

		if (command instanceof RebuildRenderCommand) {
			const { width, height, visualization: vizName } = command;
			const canvas = this.#canvas;
			const context = this.#context;
			if (canvas === null || context === null || this.#selection === null) return;

			if (vizName !== this.#selection[0]) {
				const bundle = this.#bundles.get(vizName);
				if (bundle === undefined) return;
				this.#selection = [vizName, bundle];
			}

			canvas.width = width;
			canvas.height = height;
			context.reset();
			context.resetTransform();

			const [, bundle] = this.#selection;
			bundle.rebuild();
			bundle.update();
			return;
		}
	}

	async run(): Promise<void> {
		setInterval(this.#poll.bind(this), 4);
		self.addEventListener("message", this.#onMessage.bind(this));
	}

	async catch(error: Error): Promise<void> {
		throw error;
	}
}
//#endregion

await VisualizationWorker.launch();
