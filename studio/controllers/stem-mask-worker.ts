"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { SabLayout, Signal, MaskChannel } from "../models/audio-features.js";
import { Command, InitializeMaskCommand, ModelMaskCommand, PaceMaskCommand, StatusMaskCommand, TickCommand } from "../models/commands.js";
import { type StemNetwork } from "../services/stem-network.js";
import { NetworkSlot } from "../services/network-slot.js";
import { TapHistory } from "../services/tap-history.js";
import { MaskSmoother } from "../services/mask-smoother.js";
import { InferenceBudget, InferencePace } from "../services/inference-pace.js";

//#region Stem mask worker
class StemMaskWorker extends Controller {
	#signal: Signal | null = null;
	#masks: MaskChannel | null = null;
	#shaders: string | null = null;
	#slot: NetworkSlot = new NetworkSlot();
	#history: TapHistory | null = null;
	#smoother: MaskSmoother = new MaskSmoother();
	#budget: InferenceBudget = new InferenceBudget();
	#pace: InferencePace = new InferencePace(this.#budget);
	#pending: number = 0;

	#capture(tap: Float32Array, masks: MaskChannel, network: StemNetwork, history: TapHistory): void {
		const now = performance.now();
		if (!history.capture(tap, now)) return;
		if (this.#pace.ready(now)) void this.#infer(network, history, masks);
	}

	async #infer(network: StemNetwork, history: TapHistory, masks: MaskChannel): Promise<void> {
		if (this.#pending >= network.depth) return;
		this.#pending++;
		const pace = this.#pace;
		try {
			const begun = performance.now();
			pace.start(begun);
			const predicted = await network.infer(history);
			const now = performance.now();
			masks.publish(this.#smoother.smooth(predicted, now), performance.timeOrigin + now);
			if (pace.finish(network.duration ?? now - begun, now)) this.#report(true, null, network.adapter, pace.rate, network.duration, pace.slowed);
		} catch (reason) {
			if (this.#slot.network !== network) return;
			this.#disable(reason);
		} finally {
			this.#pending--;
		}
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof InitializeMaskCommand) {
			this.#signal = new Signal(command.sabSignal);
			this.#masks = new MaskChannel(command.sabMask);
			this.#shaders = command.urlShaders;
			return;
		}

		if (command instanceof ModelMaskCommand) {
			const { urlModel } = command;
			if (urlModel === null) return this.#unload();
			void this.#load(urlModel);
			return;
		}

		if (command instanceof PaceMaskCommand) {
			this.#budget.adapt(command.loss, this.#pace.share(performance.now()));
			return;
		}

		if (command instanceof TickCommand) {
			const signal = this.#signal, masks = this.#masks, network = this.#slot.network, history = this.#history;
			if (signal === null || masks === null || network === null || history === null) return;
			this.#capture(signal.model, masks, network, history);
		}
	}

	async #load(url: string): Promise<void> {
		const slot = this.#slot;
		try {
			const shaders = this.#shaders;
			if (shaders === null) throw new ReferenceError("The splitter has no shaders before it is initialized");
			const masks = this.#masks;
			if (masks === null) throw new ReferenceError("The splitter has no masks before it is initialized");
			const network = await slot.load(url, shaders, SabLayout.bins, SabLayout.stems);
			if (network === null) return;
			this.#pace = new InferencePace(this.#budget);
			const { grid } = network;
			if (this.#history?.frames !== network.frames || !grid.equals(masks.grid)) this.#history = new TapHistory(network.frames);
			masks.grid = grid;
			this.#report(true, null, network.adapter, null, null, false);
			const loss = await slot.watch(network);
			if (loss === null) return;
			this.#disable(loss);
		} catch (reason) {
			this.#disable(reason);
		}
	}

	#unload(): void {
		this.#slot.unload();
		this.#idle(null);
	}

	#disable(reason: unknown): void {
		this.#slot.clear();
		this.#idle(Error.from(reason).message);
	}

	#idle(reason: string | null): void {
		this.#masks?.publish(this.#smoother.reset(), performance.timeOrigin + performance.now());
		this.#report(false, reason, null, null, null, false);
	}

	#report(available: boolean, reason: string | null, device: string | null, rate: number | null, milliseconds: number | null, slowed: boolean): void {
		self.postMessage(Command.export(new StatusMaskCommand(available, reason, device, rate, milliseconds, slowed)));
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await StemMaskWorker.launch();
