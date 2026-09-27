"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { Command, ChunkCommand, DoneCommand, FinishCommand } from "../models/commands.js";

//#region Clip accumulator worker
class ClipAccumulatorWorker extends Controller {
	#chunks: Blob[] = [];

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");
		const chunks = this.#chunks;

		if (command instanceof ChunkCommand) {
			chunks.push(command.data);
			return;
		}

		if (command instanceof FinishCommand) {
			const blob = new Blob(chunks, { type: command.mimeType });
			chunks.splice(0, chunks.length);
			self.postMessage(Command.export(new DoneCommand(blob)));
			return;
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await ClipAccumulatorWorker.launch();
