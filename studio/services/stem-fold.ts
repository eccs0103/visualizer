"use strict";

import "adaptive-extender/worker";
import { SabLayout } from "../models/audio-features.js";

//#region Stem fold
/** The network's shares as the visualizer's stems: a model that splits finer than the visualizer (its extra stems come after the visualizer's own) has every extra stem summed into the visualizer's last column. Every shipped model splits into exactly the visualizer's stems, so this is a plain copy. */
export class StemFold {
	#folded: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems);

	fold(shares: Float32Array, count: number): Float32Array {
		const stems = SabLayout.stems;
		const folded = this.#folded;
		const last = stems - 1;
		for (let bin = 0; bin < SabLayout.bins; bin++) {
			const source = bin * count;
			const target = bin * stems;
			for (let stem = 0; stem < last; stem++) folded[target + stem] = shares[source + stem];
			let rest = 0;
			for (let stem = last; stem < count; stem++) rest += shares[source + stem];
			folded[target + last] = rest;
		}
		return folded;
	}
}
//#endregion
