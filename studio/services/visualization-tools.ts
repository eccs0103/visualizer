"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { type AudiosetView, type StemsView } from "../models/visualization.js";

const { split, PI, exp, sqrt, asin, max, min } = Math;

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
//#region Threads
/**
 * The mix features that an effect should take from one separated thread instead of the whole mix,
 * already brought onto the mix's own scale so a visualization's existing ranges and clamps keep working.
 *
 * A thread is only part of the mix, so each value is rescaled once: its 90th percentile over the
 * MUSDB18HQ test set matches the mix feature's (the centroid by a linear map matching the 10th and
 * 90th percentiles). Each was kept only where, measured against the true isolated stems, the thread
 * tracks its instrument better than the mix does — the mix beat, drop and bass band won, so they
 * are not offered here.
 */
export class Threads {
	static #gainBassLevel: number = 1.248;
	static #gainSubBass: number = 1.145;
	static #gainHigh: number = 1.340;
	static #gainHighMid: number = 2.021;
	static #gainFlux: number = 2.128;
	static #slopeCentroid: number = 1.5036;
	static #offsetCentroid: number = -0.0364;

	/** Bass level of the bass thread: the glow follows the bass line, not the kick. */
	static bassLevel(stems: StemsView): number { return stems.bass.bassLevel * Threads.#gainBassLevel; }

	/** Sub-bass band energy of the bass thread. */
	static subBass(stems: StemsView): number { return stems.bass.subBass * Threads.#gainSubBass; }

	/** Percussiveness of the drums thread. A ratio already, so no rescale. */
	static percussiveness(stems: StemsView): number { return stems.drums.percussiveness; }

	/** High band energy of the drums thread: cymbals and hats. */
	static high(stems: StemsView): number { return stems.drums.high * Threads.#gainHigh; }

	/** High-mid band energy of the drums thread. */
	static highMid(stems: StemsView): number { return stems.drums.highMid * Threads.#gainHighMid; }

	/** Spectral flux of the melody (vocals + other): how much the tune itself is changing. */
	static flux(stems: StemsView): number { return (stems.vocals.spectralFlux + stems.other.spectralFlux) * Threads.#gainFlux; }

	/** Energy-weighted spectral centroid of the melody (vocals + other): its brightness, without cymbals and hats pulling it up. */
	static centroid(stems: StemsView): number {
		const { vocals, other } = stems;
		const energy = vocals.energy + other.energy;
		if (energy <= 0) return 0;
		const centroid = (vocals.spectralCentroid * vocals.energy + other.spectralCentroid * other.energy) / energy;
		return max(0, centroid * Threads.#slopeCentroid + Threads.#offsetCentroid);
	}
}
//#endregion
//#region Silhouette
/**
 * The spectrum a silhouette is drawn from, rebuilt from the four threads: every thread at full weight
 * except drums, which are reduced so hi-hats and snares stop jagging the shape (the drums still move
 * the picture through the camera). A gain restores the mix's typical level, so the shape keeps its
 * usual size; the buffer is reused frame to frame.
 */
export class Silhouette {
	#weightDrums: number;
	#gain: number;
	#spectrum: Float32Array = new Float32Array(0);

	constructor(weightDrums: number, gain: number) {
		this.#weightDrums = weightDrums;
		this.#gain = gain;
	}

	shape(audioset: AudiosetView): Float32Array {
		const whole = audioset.dataFrequency;
		const drums = audioset.stems.drums.dataFrequency;
		const { length } = whole;
		let spectrum = this.#spectrum;
		if (spectrum.length !== length) spectrum = this.#spectrum = new Float32Array(length);
		const reduction = 1 - this.#weightDrums, gain = this.#gain;
		for (let index = 0; index < length; index++) spectrum[index] = min(1, (whole[index] - drums[index] * reduction) * gain);
		return spectrum;
	}
}
//#endregion
