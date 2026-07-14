"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { type VisualizationBundle } from "../models/visualization.js";
import { Registry } from "../services/visualization-registry.js";
import { RenderCommand, InitializeRenderCommand, TickCommand, RebuildRenderCommand } from "../models/render-commands.js";
import { WorkerAudioset, WorkerEnvironment } from "../services/worker-visualization.js";
import "../view/visualizations.js";

//#region Visualization worker
class VisualizationWorker extends Controller {
	#bundles: Map<string, VisualizationBundle> = new Map();
	#context: OffscreenCanvasRenderingContext2D;
	#audioset: WorkerAudioset;
	#environment: WorkerEnvironment;
	#selection: string;
	#width: number = 0;
	#height: number = 0;
	#rebuilt: boolean = false;

	#rebuild(): void {
		const width = this.#width;
		const height = this.#height;
		if (width === 0 || height === 0) return;
		const context = this.#context;
		const audioset = this.#audioset;
		const environment = this.#environment;
		audioset.sync();
		environment.reset();
		const { canvas } = context;
		canvas.width = width;
		canvas.height = height;
		context.reset();
		context.resetTransform();
		const selection = this.#selection;
		const bundle = ReferenceError.suppress(this.#bundles.get(selection), `Visualization with name '${selection}' is not attached`);
		bundle.rebuild({ context, audioset, environment });
		bundle.update({ context, audioset, environment });
		this.#rebuilt = true;
	}

	#onMessage(event: MessageEvent): void {
		const command = RenderCommand.import(event.data, "command");
		const bundles = this.#bundles;

		if (command instanceof InitializeRenderCommand) {
			const { sabVideo, sabAudio, canvas } = command;

			this.#context = ReferenceError.suppress(canvas.getContext("2d"), "Failed to acquire 2D rendering context");
			const audioset = this.#audioset = new WorkerAudioset(sabVideo, sabAudio);
			this.#environment = new WorkerEnvironment(audioset);
			let selection: string | null = null;
			for (const [name, descriptor] of Registry.entries()) {
				bundles.set(name, Registry.createBundle(descriptor));
				if (selection === null) selection = name;
			}
			this.#selection = ReferenceError.suppress(selection, "Failed to find any visualization");
			canvas.addEventListener("contextlost", event => this.#rebuilt = false);
			canvas.addEventListener("contextrestored", event => this.#rebuild());
			return;
		}

		if (command instanceof TickCommand) {
			if (!this.#rebuilt) return;
			const context = this.#context;
			const audioset = this.#audioset;
			const environment = this.#environment;
			audioset.sync();
			environment.tick();
			const selection = this.#selection;
			const bundle = ReferenceError.suppress(bundles.get(selection), `Visualization with name '${selection}' is not attached`);
			bundle.update({ context, audioset, environment });
			return;
		}

		if (command instanceof RebuildRenderCommand) {
			const { width, height, visualization } = command;
			if (visualization !== this.#selection) this.#selection = visualization;
			this.#width = width;
			this.#height = height;
			this.#rebuild();
			return;
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await VisualizationWorker.launch();
