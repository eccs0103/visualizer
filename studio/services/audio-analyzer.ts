"use strict";

import "adaptive-extender/web";
import { Spectrum, StemMasks } from "../models/audio-features.js";
import { Command, InitializeAnalyzerCommand, InitializeMaskCommand, TickCommand } from "../models/commands.js";
import { type Audioset } from "../models/audioset.js";

const { baseURI } = document;

//#region Audio analyzer
export class AudioAnalyzer {
	static #tick = Command.export(new TickCommand());
	#sabFeatures: SharedArrayBuffer = Spectrum.createBuffer();
	#sabMask: SharedArrayBuffer = StemMasks.createBuffer();
	#worker: Worker = new Worker(new URL("./controllers/audio-analyzer-worker.js", baseURI), { type: "module" });
	#workerMask: Worker = new Worker(new URL("./controllers/stem-mask-worker.js", baseURI), { type: "module" });

	constructor(audioset: Audioset) {
		const { sab } = audioset.signal;
		const sabMask = this.#sabMask;
		this.#worker.postMessage(Command.export(new InitializeAnalyzerCommand(sab, this.#sabFeatures, sabMask, audioset.sampleRate)));
		const urlModel = new URL("../data/stem-mask/model.json", baseURI).toString();
		const urlWasm = new URL("../wasm/", baseURI).toString();
		this.#workerMask.postMessage(Command.export(new InitializeMaskCommand(sab, sabMask, urlModel, urlWasm)));
	}

	get sabFeatures(): SharedArrayBuffer { return this.#sabFeatures; }
	get sabMask(): SharedArrayBuffer { return this.#sabMask; }

	tick(): void {
		const tick = AudioAnalyzer.#tick;
		this.#worker.postMessage(tick);
		this.#workerMask.postMessage(tick);
	}
}
//#endregion
