"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { ChunkCommand, ClipCommand, DoneCommand, FinishCommand } from "../models/clip-commands.js";

//#region Clip accumulator worker
class ClipAccumulatorWorker extends Controller {
	#chunks: Blob[] = [];

	#onMessage(event: MessageEvent): void {
		const command = ClipCommand.import(event.data, "command");
		const chunks = this.#chunks;

		if (command instanceof ChunkCommand) {
			chunks.push(command.data);
			return;
		}

		if (command instanceof FinishCommand) {
			const blob = new Blob(chunks, { type: command.mimeType });
			chunks.splice(0, chunks.length);
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
