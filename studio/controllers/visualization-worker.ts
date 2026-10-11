"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { Registry } from "../services/visualization-registry.js";
import { Command, InitializeRenderCommand, TickCommand, RebuildRenderCommand, LyricsRenderCommand, ShakeRenderCommand, RatiosRenderCommand, LayersRenderCommand, ImageRenderCommand } from "../models/commands.js";
import { Stage } from "../services/stage.js";
import { Scene } from "../services/scene.js";
import "../view/visualizations.js";

//#region Visualization worker
class VisualizationWorker extends Controller {
	#scenes: Map<string, Scene> = new Map();
	#context: OffscreenCanvasRenderingContext2D;
	#stage: Stage;
	#selection: string;
	#width: number = 0;
	#height: number = 0;
	#rebuilt: boolean = false;
	#frame: number | null = null;

	#findScene(name: string): Scene {
		return ReferenceError.suppress(this.#scenes.get(name), `Visualization with name '${name}' is not attached`);
	}

	#select(name: string): void {
		const selection = this.#selection;
		if (name === selection) return;
		this.#findScene(selection).release();
		this.#selection = name;
	}

	#rebuild(): void {
		const width = this.#width;
		const height = this.#height;
		if (width === 0 || height === 0) return;
		const stage = this.#stage;
		const { canvas } = this.#context;
		canvas.width = width;
		canvas.height = height;
		stage.sync();
		stage.resize(canvas.width, canvas.height);
		const scene = this.#findScene(this.#selection);
		scene.rebuild();
		scene.render();
		this.#rebuilt = true;
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");
		const scenes = this.#scenes;

		if (command instanceof InitializeRenderCommand) {
			const { sabSignal, sabMask, sampleRate, canvas } = command;

			const context = this.#context = ReferenceError.suppress(canvas.getContext("2d"), "Failed to acquire 2D rendering context");
			const stage = this.#stage = new Stage(sabSignal, sabMask, sampleRate);
			let selection: string | null = null;
			for (const [name, descriptor] of Registry.entries()) {
				scenes.set(name, new Scene(name, Registry.create(descriptor), stage, context));
				if (selection === null) selection = name;
			}
			this.#selection = ReferenceError.suppress(selection, "Failed to find any visualization");
			canvas.addEventListener("contextlost", event => this.#rebuilt = false);
			canvas.addEventListener("contextrestored", event => this.#rebuild());
			return;
		}

		const stage = this.#stage;

		if (command instanceof TickCommand) {
			if (!this.#rebuilt) return;
			const frame = stage.frame;
			if (frame === this.#frame) return;
			this.#frame = frame;
			stage.sync();
			stage.tick();
			this.#findScene(this.#selection).render();
			return;
		}

		if (command instanceof RebuildRenderCommand) {
			const { width, height, visualization, hue, saturation, lightness } = command;
			stage.updateColor(hue, saturation, lightness);
			this.#select(visualization);
			this.#width = width;
			this.#height = height;
			this.#rebuild();
			return;
		}

		if (command instanceof LyricsRenderCommand) {
			const { previous, current, next } = command;
			stage.updateLyrics(previous, current, next);
			return;
		}

		if (command instanceof ShakeRenderCommand) {
			stage.updateShake(command.value);
			return;
		}

		if (command instanceof RatiosRenderCommand) {
			stage.updateRatios(command.ratios);
			return;
		}

		if (command instanceof LayersRenderCommand) {
			const { visualization, layers, background, lyrics } = command;
			this.#findScene(visualization).arrange(layers, background, lyrics);
			return;
		}

		if (command instanceof ImageRenderCommand) {
			const { visualization, image } = command;
			void this.#findScene(visualization).setBackground(image);
			return;
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await VisualizationWorker.launch();
