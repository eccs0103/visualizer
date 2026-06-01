"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { ChunkCommand, ClipCommand, DoneCommand, FinishCommand } from "../models/clip-commands.js";

//#region Clip accumulator worker
class ClipAccumulatorWorker extends Controller {
	#chunks: Blob[] = [];

	#onMessage(event: MessageEvent): void {
		const command = ClipCommand.import(event.data, "command");

		if (command instanceof ChunkCommand) {
			this.#chunks.push(command.data);
			return;
		}

		if (command instanceof FinishCommand) {
			const blob = new Blob(this.#chunks, { type: command.mimeType });
			this.#chunks = [];
			self.postMessage(ClipCommand.export(new DoneCommand(blob)));
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

await ClipAccumulatorWorker.launch();
