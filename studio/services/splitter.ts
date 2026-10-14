"use strict";

import "adaptive-extender/web";
import { MaskChannel } from "../models/audio-features.js";
import { Command, InitializeMaskCommand, ModelMaskCommand, StatusMaskCommand, TickCommand } from "../models/commands.js";

const { baseURI } = document;

//#region Splitter
export enum SplitterModel {
	standard,
	presence,
	memory,
	listening,
}

export interface SplitterEventMap {
	"status": Event;
}

export class Splitter extends EventTarget {
	static #tick = Command.export(new TickCommand());
	#worker: Worker = new Worker(new URL("./controllers/stem-mask-worker.js", baseURI), { type: "module" });
	#masks: MaskChannel = MaskChannel.create();
	#status: StatusMaskCommand | null = null;
	#model: SplitterModel = SplitterModel.listening;

	constructor(sabSignal: SharedArrayBuffer) {
		super();
		const worker = this.#worker;
		worker.addEventListener("message", event => this.#onMessage(event));
		worker.postMessage(Command.export(new InitializeMaskCommand(sabSignal, this.#masks.sab, Splitter.#locate(this.#model), new URL("../shaders/", baseURI).toString())));
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

	get masks(): MaskChannel { return this.#masks; }
	get status(): StatusMaskCommand | null { return this.#status; }
	get model(): SplitterModel { return this.#model; }

	set model(value: SplitterModel) {
		if (value === this.#model) return;
		this.#model = value;
		this.#worker.postMessage(Command.export(new ModelMaskCommand(Splitter.#locate(value))));
	}

	tick(): void {
		this.#worker.postMessage(Splitter.#tick);
	}

	static #locate(model: SplitterModel): string {
		switch (model) {
		case SplitterModel.standard: return new URL("../data/stem-mask/model.json", baseURI).toString();
		case SplitterModel.presence: return new URL("../data/stem-mask-presence/model.json", baseURI).toString();
		case SplitterModel.memory: return new URL("../data/stem-mask-c64/model.json", baseURI).toString();
		case SplitterModel.listening: return new URL("../data/stem-mask-listening/model.json", baseURI).toString();
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
