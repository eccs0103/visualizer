"use strict";

import "adaptive-extender/worker";
import { StemNetwork } from "./stem-network.js";

//#region Network slot
export class NetworkSlot {
	#network: StemNetwork | null = null;
	#loads: number = 0;
	#tickets: WeakMap<StemNetwork, number> = new WeakMap();

	get network(): StemNetwork | null { return this.#network; }

	async load(url: string, shaders: string, bins: number, stems: number): Promise<StemNetwork | null> {
		const ticket = ++this.#loads;
		try {
			const network = await StemNetwork.create(new URL(url), new URL(shaders), bins, stems);
			if (ticket !== this.#loads) {
				network.destroy();
				return null;
			}
			this.#network?.destroy();
			this.#network = network;
			this.#tickets.set(network, ticket);
			return network;
		} catch (reason) {
			if (ticket !== this.#loads) return null;
			throw reason;
		}
	}

	async watch(network: StemNetwork): Promise<Error | null> {
		const { reason, message } = await network.lost;
		if (reason === "destroyed") return null;
		if (this.#tickets.get(network) !== this.#loads) return null;
		return new Error(`The GPU device was lost: ${message}`);
	}

	clear(): void {
		this.#network?.destroy();
		this.#network = null;
	}

	unload(): void {
		this.#loads++;
		this.#network?.destroy();
		this.#network = null;
	}
}
//#endregion
