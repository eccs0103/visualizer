"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { Color } from "adaptive-extender/core";
import { SabLayout } from "../models/audio-features.js";
import { type AudiosetView, type VisualizationBundle, type VisualizationEnvironment, Registry } from "../services/visualization-registry.js";
import { RenderCommand, InitializeRenderCommand, TickCommand, RebuildRenderCommand } from "../models/render-commands.js";
import { RenderBridge } from "../services/render-bridge.js";
import "../view/visualizations.js";

//#region Worker audioset view
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
//#endregion
//#region Worker environment
class WorkerEnvironment implements VisualizationEnvironment {
	#audioset: WorkerAudiosetView;
	#lastTime: number = NaN;
	#delta: number = NaN;

	constructor(audioset: WorkerAudiosetView) {
		this.#audioset = audioset;
	}

	tick(): void {
		const now = performance.now() / 1000;
		this.#delta = Number.isFinite(this.#lastTime) ? now - this.#lastTime : NaN;
		this.#lastTime = now;
	}

	get isLaunched(): boolean { return true; }
	get delta(): number { return this.#delta; }
	get fps(): number { return Number.isFinite(this.#delta) && this.#delta > 0 ? 1 / this.#delta : 0; }

	get colorBackground(): Color {
		const { colorH, colorS, colorL } = this.#audioset;
		return Color.fromHSL(colorH, colorS, colorL);
	}
}
//#endregion
//#region Visualization worker
class VisualizationWorker extends Controller {
	#bundles: Map<string, VisualizationBundle> = new Map();
	#context: OffscreenCanvasRenderingContext2D;
	#audioset: WorkerAudiosetView;
	#environment: WorkerEnvironment;
	#selection: string;

	#onMessage(event: MessageEvent): void {
		const command = RenderCommand.import(event.data, "command");
		const bundles = this.#bundles;

		if (command instanceof InitializeRenderCommand) {
			const { sab, canvas } = command;

			const context = this.#context = ReferenceError.suppress(canvas.getContext("2d"), "Failed to acquire 2D rendering context");
			const audioset = this.#audioset = new WorkerAudiosetView(sab);
			const environment = this.#environment = new WorkerEnvironment(audioset);
			let selection: string | null = null;
			for (const [name, descriptor] of Registry.entries()) {
				bundles.set(name, Registry.createBundle({ context, audioset, environment }, descriptor));
				if (selection === null) selection = name;
			}
			this.#selection = ReferenceError.suppress(selection, "Failed to find any visualization");
			return;
		}

		if (command instanceof TickCommand) {
			this.#audioset.sync();
			this.#environment.tick();
			const selection = this.#selection;
			const bundle = ReferenceError.suppress(bundles.get(selection), `Visualization with name '${selection}' is not attached`);
			bundle.update();
			return;
		}

		if (command instanceof RebuildRenderCommand) {
			const context = this.#context;
			const { canvas } = context;
			const { width, height, visualization } = command;

			if (visualization !== this.#selection) this.#selection = visualization;
			canvas.width = width;
			canvas.height = height;
			context.reset();
			context.resetTransform();
			const selection = this.#selection;
			const bundle = ReferenceError.suppress(bundles.get(selection), `Visualization with name '${selection}' is not attached`);
			bundle.rebuild();
			bundle.update();
			return;
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}

	async catch(error: Error): Promise<void> {
		throw error;
	}
}
//#endregion

await VisualizationWorker.launch();
