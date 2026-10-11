"use strict";

import "adaptive-extender/web";
import { Command, InitializeMaskCommand, ModelMaskCommand, StatusMaskCommand, TickCommand } from "../models/commands.js";
import { MaskChannel } from "./mask-channel.js";

const { baseURI } = document;

//#region Splitter
/** Which trained model the splitter runs: the shipped one, or the presence-gated test model. */
export enum SplitterModel {
	current,
	presence,
}

export interface SplitterEventMap {
	"status": Event;
}

/** The AI stem splitter, seen from the main thread: its worker (which reads the audio from the signal buffer and publishes masks into `sab`), the trained model it runs, and the state it last reported. */
export class Splitter extends EventTarget {
	static #tick = Command.export(new TickCommand());
	#worker: Worker = new Worker(new URL("./controllers/stem-mask-worker.js", baseURI), { type: "module" });
	#sab: SharedArrayBuffer = MaskChannel.createBuffer();
	#status: StatusMaskCommand | null = null;
	#model: SplitterModel = SplitterModel.current;

	constructor(sabSignal: SharedArrayBuffer) {
		super();
		const worker = this.#worker;
		worker.addEventListener("message", event => this.#onMessage(event));
		worker.postMessage(Command.export(new InitializeMaskCommand(sabSignal, this.#sab, Splitter.#locate(this.#model), new URL("../shaders/", baseURI).toString())));
	}

	addEventListener<K extends keyof SplitterEventMap>(type: K, listener: (this: Splitter, event: SplitterEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof SplitterEventMap>(type: K, listener: (this: Splitter, event: SplitterEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		return super.removeEventListener(type, listener, options);
	}

	/** The masks the splitter publishes, for the render worker. */
	get sab(): SharedArrayBuffer { return this.#sab; }

	/** The state the splitter last reported; `null` while its first model is still loading. */
	get status(): StatusMaskCommand | null { return this.#status; }

	get model(): SplitterModel { return this.#model; }

	set model(value: SplitterModel) {
		if (value === this.#model) return;
		this.#model = value;
		this.#worker.postMessage(Command.export(new ModelMaskCommand(Splitter.#locate(value))));
	}

	/** Lets the splitter take the audio of this frame. */
	tick(): void {
		this.#worker.postMessage(Splitter.#tick);
	}

	static #locate(model: SplitterModel): string {
		switch (model) {
		case SplitterModel.current: return new URL("../data/stem-mask/model.json", baseURI).toString();
		case SplitterModel.presence: return new URL("../data/stem-mask-presence/model.json", baseURI).toString();
		default: throw new TypeError(`Invalid '${model}' splitter model`);
		}
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");
		if (!(command instanceof StatusMaskCommand)) return;
		this.#status = command;
		this.dispatchEvent(new Event("status"));
	}
}
//#endregion
