"use strict";

import "adaptive-extender/core";
import { Stems, type Stem } from "../models/stem.js";
import { StemGains } from "../models/stem-gains.js";
import { MaskChannel } from "./mask-channel.js";
import { MaskBlend } from "./mask-blend.js";
import { StemSpectrum } from "./stem-spectrum.js";
import { StemMixdown } from "./stem-mixdown.js";

//#region Stem spectra
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

	invalidate(now: number = performance.timeOrigin + performance.now()): void {
		if (this.#blend.refresh(now)) this.forget();
	}

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

	mix(length: number, whole: Float32Array): Float32Array {
		return this.#mixdown.read(this.#blend, this.#gains, length, whole);
	}

	level(length: number, whole: Float32Array): number {
		return this.#mixdown.level(this.#blend, this.#gains, length, whole);
	}
}
//#endregion
