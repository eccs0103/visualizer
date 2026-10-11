"use strict";

import "adaptive-extender/worker";
import { StemNetwork } from "./stem-network.js";

//#region Network slot
export class NetworkSlot {
	#network: StemNetwork | null = null;
	#loads: number = 0;
	#tickets: WeakMap<StemNetwork, number> = new WeakMap();

	get network(): StemNetwork | null { return this.#network; }

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

	async watch(network: StemNetwork): Promise<Error | null> {
		const { reason, message } = await network.lost;
		if (reason === "destroyed") return null;
		if (this.#tickets.get(network) !== this.#loads) return null;
		return new Error(`The GPU device was lost: ${message}`);
	}

	clear(): void {
		this.#network = null;
	}
}
//#endregion
