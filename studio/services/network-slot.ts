"use strict";

import "adaptive-extender/worker";
import { StemNetwork } from "./stem-network.js";

//#region Network slot
/** The network the splitter runs. Loads may overlap (the user switches models faster than they load): the newest load always wins, and whatever an older one does afterwards — finishing, failing, losing its GPU — is ignored. */
export class NetworkSlot {
	#network: StemNetwork | null = null;
	#loads: number = 0;
	#tickets: WeakMap<StemNetwork, number> = new WeakMap();

	/** The running network; `null` before the first load and after `clear`. */
	get network(): StemNetwork | null { return this.#network; }

	/** Loads the model at `url` (with the shaders from the folder `shaders`) and swaps it in for the running one, which is destroyed. Resolves `null` when a newer load was started meanwhile; rejects when this, the newest load, fails. */
	async load(url: string, shaders: string, frames: number, bins: number, stems: number): Promise<StemNetwork | null> {
		const ticket = ++this.#loads;
		try {
			const network = await StemNetwork.create(new URL(url), new URL(shaders), frames, bins);
			if (ticket !== this.#loads) {
				network.destroy();
				return null;
			}
			if (network.stems < stems) throw new TypeError(`The model splits into ${network.stems} stems, the visualizer needs at least ${stems}`);
			this.#network?.destroy();
			this.#network = network;
			this.#tickets.set(network, ticket);
			return network;
		} catch (reason) {
			if (ticket !== this.#loads) return null;
			throw reason;
		}
	}

	/** Resolves when `network` stops running: with why, when its GPU device was lost while it was still the newest load; `null` when it was replaced or a newer load superseded it. */
	async watch(network: StemNetwork): Promise<Error | null> {
		const { reason, message } = await network.lost;
		if (reason === "destroyed") return null;
		if (this.#tickets.get(network) !== this.#loads) return null;
		return new Error(`The GPU device was lost: ${message}`);
	}

	/** Stops the splitter: no network runs until the next load. */
	clear(): void {
		this.#network = null;
	}
}
//#endregion
