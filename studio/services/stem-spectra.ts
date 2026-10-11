"use strict";

import "adaptive-extender/core";
import { Stems, type Stem } from "../models/stem.js";
import { StemGains } from "../models/stem-gains.js";
import { MaskChannel } from "./mask-channel.js";
import { MaskBlend } from "./mask-blend.js";
import { StemSpectrum } from "./stem-spectrum.js";
import { StemMixdown } from "./stem-mixdown.js";

//#region Stem spectra
/** The render side of the splitter: every stem's spectrum and the whole mix, from the masks the AI worker publishes. Each is computed lazily, only when read, and kept until the masks, the gains or the audio frame change — a visualization using one stem never pays for the others. */
export class StemSpectra {
	#blend: MaskBlend;
	#spectra: Map<Stem, StemSpectrum> = new Map();
	#mixdown: StemMixdown = new StemMixdown();
	#gains: StemGains = StemGains.unit;

	constructor(sabMask: SharedArrayBuffer) {
		this.#blend = new MaskBlend(new MaskChannel(sabMask));
		const spectra = this.#spectra;
		for (const stem of Stems.all) spectra.set(stem, new StemSpectrum(stem));
	}

	/** Call once per rendered frame — cheap: the masks are re-blended only when a new version was published or the blend moved on. */
	invalidate(now: number = performance.timeOrigin + performance.now()): void {
		if (this.#blend.refresh(now)) this.forget();
	}

	/** Drops every cached array; call it whenever `whole` changed (a new audio frame), or the arrays keep the old spectrum. */
	forget(): void {
		for (const spectrum of this.#spectra.values()) spectrum.forget();
		this.#mixdown.forget();
	}

	weigh(gains: StemGains): void {
		this.#gains = gains;
		this.forget();
	}

	spectrum(stem: Stem, length: number, whole: Float32Array): Float32Array {
		const spectrum = this.#spectra.get(stem);
		if (spectrum === undefined) throw new ReferenceError(`No spectrum for the '${stem}' stem`);
		return spectrum.read(this.#blend, this.#gains, length, whole);
	}

	/** The whole spectrum as the sum of the stems at their gains (`whole` itself, bit for bit, at every gain 1). */
	mix(length: number, whole: Float32Array): Float32Array {
		return this.#mixdown.read(this.#blend, this.#gains, length, whole);
	}

	level(length: number, whole: Float32Array): number {
		return this.#mixdown.level(this.#blend, this.#gains, length, whole);
	}
}
//#endregion
