"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { type AudiosetView } from "../models/visualization.js";

const { split, PI, exp, sqrt, asin } = Math;

//#region Shaper
export class Shaper {
	static #arcsinSaturate: Shaper = new Shaper(x => asin(sqrt(x)) * 2 / PI);
	static #smoothstep: Shaper = new Shaper(x => x * x * (3 - 2 * x));
	static #identity: Shaper = new Shaper(x => x);

	#callback: (x: number) => number;

	constructor(callback: (x: number) => number) {
		this.#callback = callback;
	}

	static get arcsinSaturate(): Shaper { return this.#arcsinSaturate; }
	static get smoothstep(): Shaper { return this.#smoothstep; }
	static get identity(): Shaper { return this.#identity; }

	static sigmoid(steepness: number = 12, center: number = 0.5): Shaper {
		return new Shaper(x => 1 / (1 + exp(-(steepness * (x - center)))));
	}

	static power(n: number): Shaper {
		return new Shaper(x => x ** n);
	}

	apply(value: number): number {
		return this.#callback(value);
	}

	then(next: Shaper): Shaper {
		const callback = this.#callback;
		return new Shaper(x => next.apply(callback(x)));
	}

	blend(other: Shaper, alpha: number = 0.5): Shaper {
		const callback = this.#callback;
		return new Shaper(x => callback(x) * (1 - alpha) + other.apply(x) * alpha);
	}

	mirror(): Shaper {
		const callback = this.#callback;
		return new Shaper(x => callback(1 - x));
	}

	invert(): Shaper {
		const callback = this.#callback;
		return new Shaper(x => 1 - callback(x));
	}

	remap(value: number, min2: number, max2: number): number {
		return this.#callback(value).lerp(0, 1, min2, max2);
	}
}
//#endregion
//#region Color driver
export class ColorDriver {
	static #rotation: ColorDriver = new ColorDriver((color, steps) => color.rotate(steps));
	#offset: number = 0;
	#callback: (color: Color, steps: number) => void;

	constructor(callback: (color: Color, steps: number) => void) {
		this.#callback = callback;
	}

	static get rotation(): ColorDriver { return this.#rotation; }

	tick(color: Color, ratePerMs: number, delta: number, factor: number = 1): void {
		if (!Number.isFinite(delta)) return;
		const [integer, fractional] = split(this.#offset + ratePerMs * delta * factor);
		this.#callback(color, integer);
		this.#offset = fractional;
	}
}
//#endregion
//#region Stems
/** The four stems in drawing order, bottom to top — the order of `Stems.spectra` and `Stems.palette`. */
export enum Stem {
	Other,
	Vocals,
	Bass,
	Drums,
}

export class Stems {
	static #offsets: number[] = [270, 185, 0, 35]; // other, vocals, bass, drums — violet, cyan, red, amber from a red seed

	/** This frame's isolated spectra (`whole × mask`), indexed by `Stem` — grabbed once, since the audioset getters are not free. */
	static spectra(audioset: AudiosetView): Float32Array[] {
		return [audioset.dataFrequencyOther, audioset.dataFrequencyVocals, audioset.dataFrequencyBass, audioset.dataFrequencyDrums];
	}

	/** CSS colors indexed by `Stem` — fixed hue offsets around the seed, so the caller's rotation driver still animates all four together. */
	static palette(seed: Color, hueBias: number, illumination: number): string[] {
		return Stems.#offsets.map(offset => new Color(seed).rotate(offset + hueBias).illuminate(illumination).toString());
	}
}
//#endregion
