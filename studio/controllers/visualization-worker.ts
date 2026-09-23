"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { Registry } from "../services/visualization-registry.js";
import { RenderCommand, InitializeRenderCommand, TickCommand, RebuildRenderCommand, LyricsRenderCommand, ShakeRenderCommand, LayersRenderCommand, EngineRenderCommand, ImageRenderCommand } from "../models/render-commands.js";
import { WorkerAudioset, WorkerEnvironment } from "../services/worker-visualization.js";
import { Stage } from "../services/stage.js";
import { BackgroundLayer, LyricsLayer } from "../services/engine-layers.js";
import "../view/visualizations.js";

//#region Visualization worker
class VisualizationWorker extends Controller {
	#stages: Map<string, Stage> = new Map();
	#background: BackgroundLayer = new BackgroundLayer();
	#lyrics: LyricsLayer = new LyricsLayer();
	#context: OffscreenCanvasRenderingContext2D;
	#audioset: WorkerAudioset;
	#environment: WorkerEnvironment;
	#selection: string;
	#width: number = 0;
	#height: number = 0;
	#rebuilt: boolean = false;
	#frame: number = -1;

	#findStage(name: string): Stage {
		return ReferenceError.suppress(this.#stages.get(name), `Visualization with name '${name}' is not attached`);
	}

	async #loadImage(image: Blob | null): Promise<void> {
		try {
			await this.#background.setImage(image);
		} catch (reason) {
			console.error(`The background image could not be decoded:
${Error.from(reason)}`);
		}
	}

	#select(name: string): void {
		if (name === this.#selection) return;
		this.#findStage(this.#selection).release();
		this.#selection = name;
	}

	#rebuild(): void {
		const width = this.#width;
		const height = this.#height;
		if (width === 0 || height === 0) return;
		const context = this.#context;
		this.#audioset.sync();
		this.#environment.reset();
		const { canvas } = context;
		canvas.width = width;
		canvas.height = height;
		const stage = this.#findStage(this.#selection);
		stage.rebuild(width, height);
		stage.render(context);
		this.#rebuilt = true;
	}

	#onMessage(event: MessageEvent): void {
		const command = RenderCommand.import(event.data, "command");
		const stages = this.#stages;

		if (command instanceof InitializeRenderCommand) {
			const { sabVideo, sabAudio, canvas } = command;

			this.#context = ReferenceError.suppress(canvas.getContext("2d"), "Failed to acquire 2D rendering context");
			const audioset = this.#audioset = new WorkerAudioset(sabVideo, sabAudio);
			const environment = this.#environment = new WorkerEnvironment(audioset);
			let selection: string | null = null;
			for (const [name, descriptor] of Registry.entries()) {
				stages.set(name, new Stage(name, Registry.createBundle(descriptor), this.#background, this.#lyrics, audioset, environment));
				if (selection === null) selection = name;
			}
			this.#selection = ReferenceError.suppress(selection, "Failed to find any visualization");
			canvas.addEventListener("contextlost", event => this.#rebuilt = false);
			canvas.addEventListener("contextrestored", event => this.#rebuild());
			return;
		}

		if (command instanceof TickCommand) {
			if (!this.#rebuilt) return;
			const frame = this.#audioset.frame;
			if (frame === this.#frame) return;
			this.#frame = frame;
			this.#audioset.sync();
			this.#environment.tick();
			this.#findStage(this.#selection).render(this.#context);
			return;
		}

		if (command instanceof RebuildRenderCommand) {
			const { width, height, visualization } = command;
			this.#select(visualization);
			this.#width = width;
			this.#height = height;
			this.#rebuild();
			return;
		}

		if (command instanceof LyricsRenderCommand) {
			const { previous, current, next } = command;
			this.#environment.updateLyrics(previous, current, next);
			return;
		}

		if (command instanceof ShakeRenderCommand) {
			this.#environment.updateShake(command.value);
			return;
		}

		if (command instanceof LayersRenderCommand) {
			const { visualization, layers } = command;
			this.#findStage(visualization).arrange(layers);
			return;
		}

		if (command instanceof EngineRenderCommand) {
			const { background, lyrics } = command;
			this.#background.apply(background);
			this.#lyrics.apply(lyrics);
			return;
		}

		if (command instanceof ImageRenderCommand) {
			void this.#loadImage(command.image);
			return;
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await VisualizationWorker.launch();
