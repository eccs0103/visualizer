"use strict";

import "adaptive-extender/worker";
import { Command, type StatusMaskCommand } from "../models/commands.js";

//#region Status reporter
/** Tells the main thread the splitter's state, only when something the user can see changed. */
export class StatusReporter {
	#status: StatusMaskCommand | null = null;

	report(status: StatusMaskCommand): void {
		const previous = this.#status;
		if (previous !== null && previous.equals(status)) return;
		this.#status = status;
		self.postMessage(Command.export(status));
	}
}
//#endregion
