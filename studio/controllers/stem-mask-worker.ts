"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { SabLayout, Signal } from "../models/audio-features.js";
import { Command, InitializeMaskCommand, ModelMaskCommand, StatusMaskCommand, TickCommand } from "../models/commands.js";
import { type StemNetwork } from "../services/stem-network.js";
import { MaskChannel } from "../services/mask-channel.js";
import { NetworkSlot } from "../services/network-slot.js";
import { TapHistory } from "../services/tap-history.js";
import { MaskSmoother } from "../services/mask-smoother.js";
import { StemFold } from "../services/stem-fold.js";
import { InferencePace } from "../services/inference-pace.js";
import { StatusReporter } from "../services/status-reporter.js";

//#region Stem mask worker
class StemMaskWorker extends Controller {
	static #frames: number = 16;
	static #acceptable: number = 100;

	#signal: Signal | null = null;
	#masks: MaskChannel | null = null;
	#shaders: string | null = null;
	#slot: NetworkSlot = new NetworkSlot();
	#history: TapHistory = new TapHistory(StemMaskWorker.#frames);
	#smoother: MaskSmoother = new MaskSmoother();
	#fold: StemFold = new StemFold();
	#pace: InferencePace = new InferencePace();
	#reporter: StatusReporter = new StatusReporter();
	#busy: boolean = false;

	#capture(tap: Float32Array, masks: MaskChannel, network: StemNetwork): void {
		const now = performance.now();
		if (!this.#history.capture(tap, now)) return;
		if (this.#pace.ready(now)) void this.#infer(network, masks);
	}

	async #infer(network: StemNetwork, masks: MaskChannel): Promise<void> {
		if (this.#busy) return;
		this.#busy = true;
		const pace = this.#pace;
		try {
			pace.start(performance.now());
			const predicted = this.#fold.fold(await network.infer(this.#history.pack()), network.stems);
			const now = performance.now();
			masks.publish(this.#smoother.smooth(predicted, now), performance.timeOrigin + now);
			if (pace.finish(now)) this.#reporter.report(new StatusMaskCommand(true, null, network.adapter, pace.rate, pace.slowed(StemMaskWorker.#acceptable)));
		} catch (reason) {
			if (this.#slot.network !== network) return;
			this.#disable(reason);
		} finally {
			this.#busy = false;
		}
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof InitializeMaskCommand) {
			this.#signal = new Signal(command.sabSignal);
			this.#masks = new MaskChannel(command.sabMask);
			this.#shaders = command.urlShaders;
			void this.#load(command.urlModel);
			return;
		}

		if (command instanceof ModelMaskCommand) {
			void this.#load(command.urlModel);
			return;
		}

		if (command instanceof TickCommand) {
			const signal = this.#signal, masks = this.#masks, network = this.#slot.network;
			if (signal === null || masks === null || network === null) return;
			this.#capture(signal.model, masks, network);
		}
	}

	async #load(url: string): Promise<void> {
		const slot = this.#slot;
		try {
			const shaders = this.#shaders;
			if (shaders === null) throw new ReferenceError("The splitter has no shaders before it is initialized");
			const network = await slot.load(url, shaders, StemMaskWorker.#frames, SabLayout.bins, SabLayout.stems);
			if (network === null) return;
			this.#reporter.report(new StatusMaskCommand(true, null, network.adapter, null, false));
			const loss = await slot.watch(network);
			if (loss === null) return;
			this.#disable(loss);
		} catch (reason) {
			this.#disable(reason);
		}
	}

	#disable(reason: unknown): void {
		this.#slot.clear();
		this.#masks?.publish(this.#smoother.reset(), performance.timeOrigin + performance.now());
		this.#reporter.report(new StatusMaskCommand(false, Error.from(reason).message, null, null, false));
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await StemMaskWorker.launch();
