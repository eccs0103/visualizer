"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";
import { type AudiosetView } from "../models/visualization.js";

const { split, PI, exp, sqrt, asin, min } = Math;

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
//#region Drivers
/**
 * The inputs the built-in visualizations feed their effects, each taken from the source that best
 * follows the instrument the effect stands for, and fitted so the effect sweeps its whole designed range.
 *
 * Every driver maps its source's 5th percentile to the low end and its 95th percentile to the high end
 * of the range the visualizations already use (the number after each name below), measured over the
 * MUSDB18HQ test set at the default analyser settings. Without the fit, the mix inputs sat pinned: glow
 * at its maximum ~90% of the time, shake ~76%, while shimmer used ~10% of its range. The source for each
 * was chosen by correlation with the true isolated instrument; the mix stays where it measured better
 * (beat timing, the bass band — which keeps production's own range, since every fit tracked the bass worse).
 */
export class Drivers {
	static #drop: [number, number] = [0.0455, 0.9471];
	static #percussiveness: [number, number] = [0.0259, 1];
	static #bassLevel: [number, number] = [0.0240, 0.7524];
	static #subBass: [number, number] = [0.0285, 0.8544];
	static #centroid: [number, number] = [0.0930, 0.3115];
	static #high: [number, number] = [0.0006, 0.2653];
	static #highMid: [number, number] = [0.0071, 0.3011];
	static #flux: [number, number] = [0.0010, 0.0202];
	static #volume: [number, number] = [0.0355, 0.1996];

	static #fit(value: number, [low, high]: [number, number], top: number): number {
		return value.clamp(low, high).lerp(low, high, 0, top);
	}

	/** Shake, 0–0.5: the drop formula with the drums thread's percussiveness — kicks shake the view, not bass notes. Tracks the kick 0.395 vs 0.225. */
	static drop(audioset: AudiosetView): number {
		const { subBass, stems } = audioset;
		return Drivers.#fit(min(1, stems.drums.percussiveness * 3) * subBass, Drivers.#drop, 0.5);
	}

	/** Pulse and wave punch, 0–1: the drums thread's percussiveness. Tracks the drums 0.658 vs 0.606. */
	static percussiveness(audioset: AudiosetView): number { return Drivers.#fit(audioset.stems.drums.percussiveness, Drivers.#percussiveness, 1); }

	/** Glow, blur and illumination, 0–0.6: the bass thread's bass level — the glow follows the bass line, not the kick. Tracks the bass 0.462 vs 0.353. */
	static bassLevel(audioset: AudiosetView): number { return Drivers.#fit(audioset.stems.bass.bassLevel, Drivers.#bassLevel, 0.6); }

	/** Bloom radius, 0–0.8: the bass thread's sub-bass band. Tracks the bass 0.466 vs 0.447. */
	static subBass(audioset: AudiosetView): number { return Drivers.#fit(audioset.stems.bass.subBass, Drivers.#subBass, 0.8); }

	/** Colour, 0–0.45: the melody's (vocals + other) energy-weighted centroid — hi-hats stop pulling the hue. Tracks the melody 0.557 vs 0.455. */
	static centroid(audioset: AudiosetView): number {
		const { vocals, other } = audioset.stems;
		const energy = vocals.energy + other.energy;
		if (energy <= 0) return 0;
		return Drivers.#fit((vocals.spectralCentroid * vocals.energy + other.spectralCentroid * other.energy) / energy, Drivers.#centroid, 0.45);
	}

	/** Sparkle, 0–0.5: the drums thread's high band — cymbals and hats. Tracks the drums 0.837 vs 0.824. */
	static high(audioset: AudiosetView): number { return Drivers.#fit(audioset.stems.drums.high, Drivers.#high, 0.5); }

	/** Sparkle, 0–0.6: the drums thread's high-mid band. Tracks the drums 0.560 vs 0.320. */
	static highMid(audioset: AudiosetView): number { return Drivers.#fit(audioset.stems.drums.highMid, Drivers.#highMid, 0.6); }

	/** Shimmer, 0–0.3: the melody's (vocals + other) spectral flux — how much the tune itself is changing. Tracks it 0.232 vs 0.048; vocals alone scored the same but would leave instrumentals still. */
	static flux(audioset: AudiosetView): number {
		const { vocals, other } = audioset.stems;
		return Drivers.#fit(vocals.spectralFlux + other.spectralFlux, Drivers.#flux, 0.3);
	}

	/** Loudness for ranges, 0–1: the mix volume, which otherwise stays below 0.2. Only for inputs used as a range, never as a raw multiplier. */
	static volume(audioset: AudiosetView): number { return Drivers.#fit(audioset.volume, Drivers.#volume, 1); }

	/** Same as `volume` for the amplitude — both are the RMS of the same waveform. */
	static amplitude(audioset: AudiosetView): number { return Drivers.#fit(audioset.amplitude, Drivers.#volume, 1); }
}
//#endregion
//#region Silhouette
/**
 * The spectrum a silhouette is drawn from, rebuilt from the four threads: every thread at full weight
 * except drums, which are reduced so hi-hats and snares stop jagging the shape (the drums still move
 * the picture through the camera). A gain lets the shape's peaks reach the mix's own height; the
 * buffer is reused frame to frame.
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
