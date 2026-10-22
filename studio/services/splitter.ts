"use strict";

import "adaptive-extender/web";
import { MaskChannel } from "../models/audio-features.js";
import { Command, InitializeMaskCommand, ModelMaskCommand, PaceMaskCommand, StatusMaskCommand, TickCommand } from "../models/commands.js";
import { SplitterCatalog, type SplitterModel } from "../models/splitter-catalog.js";
import { type SplitterStatus, LoadingStatus, OffStatus, ActiveStatus, UnavailableStatus } from "../models/splitter-status.js";
import { StemWeights } from "../models/stem-weights.js";
import { type FrameRate } from "./smoothness.js";

const { baseURI } = document;

//#region Splitter
export interface SplitterEventMap {
	"status": Event;
}

export class Splitter extends EventTarget {
	static #source: URL = new URL("../models.json", baseURI);
	#worker: Worker = new Worker(new URL("./controllers/stem-mask-worker.js", baseURI), { type: "module" });
	#masks: MaskChannel = MaskChannel.create();
	#status: SplitterStatus = new OffStatus();
	#model: SplitterModel | null = null;
	#catalog: Promise<SplitterCatalog>;

	constructor(sabSignal: SharedArrayBuffer) {
		super();
		const worker = this.#worker;
		worker.addEventListener("message", event => this.#onMessage(event));
		worker.postMessage(Command.export(new InitializeMaskCommand(sabSignal, this.#masks.sab, new URL("../shaders/", baseURI).toString())));
		this.#catalog = Splitter.#open();
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
	get status(): SplitterStatus { return this.#status; }
	get catalog(): Promise<SplitterCatalog> { return this.#catalog; }
	get model(): SplitterModel | null { return this.#model; }

	set model(value: SplitterModel | null) {
		if (value === this.#model) return;
		this.#model = value;
		this.#mark(value === null ? new OffStatus() : new LoadingStatus());
		this.#worker.postMessage(Command.export(new ModelMaskCommand(value === null ? null : Splitter.#manifest(value).toString())));
	}

	tick(): void {
		this.#worker.postMessage(Command.export(new TickCommand()));
	}

	pace(frames: FrameRate): void {
		this.#worker.postMessage(Command.export(new PaceMaskCommand(frames.falls(1))));
	}

	static #manifest(model: SplitterModel): URL {
		return new URL(`${model.folder}/model.json`, Splitter.#source);
	}

	static async #fetch(url: Readonly<URL>): Promise<unknown> {
		const response = await fetch(url);
		if (!response.ok) throw new ReferenceError(`Unable to load '${url}': ${response.status} ${response.statusText}`);
		return await response.json();
	}

	static async #weigh(model: SplitterModel): Promise<void> {
		try {
			const weights = StemWeights.import(await Splitter.#fetch(Splitter.#manifest(model)), "model");
			model.weigh(weights.length);
		} catch (reason) {
			console.error(`Failed to read the size of the '${model.name}' model cause:\n${Error.from(reason)}`);
		}
	}

	static async #open(): Promise<SplitterCatalog> {
		const catalog = SplitterCatalog.import(await Splitter.#fetch(Splitter.#source), "catalog");
		await Promise.all(catalog.models.map(Splitter.#weigh));
		return catalog;
	}

	#mark(status: SplitterStatus): void {
		this.#status = status;
		this.dispatchEvent(new Event("status"));
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");
		if (!(command instanceof StatusMaskCommand)) return;
		const { available, reason, device, rate, milliseconds, slowed } = command;
		if (available) return this.#mark(new ActiveStatus(device, rate, milliseconds, slowed));
		if (reason !== null) return this.#mark(new UnavailableStatus(reason));
		this.#mark(new OffStatus());
	}
}
//#endregion
