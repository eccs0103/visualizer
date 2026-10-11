"use strict";

import "adaptive-extender/core";

//#region Scaled waveform
/** The analyser's waveform scaled around its 0.5 centre by the share of the spectrum the stem gains keep: the masks can't split a waveform, so only its size follows them. `t × 1 + 0.5 × 0` is `t` exactly, so at every gain 1 it is the analyser's own waveform. */
export class ScaledWaveform {
	#values: Float32Array = new Float32Array(0);
	#level: number | null = null;
	#frame: number | null = null;

	/** `temporal` scaled by `level`, kept while the audio `frame` and the level stay the same. */
	shape(temporal: Float32Array, level: number, frame: number | null): Float32Array {
		let values = this.#values;
		if (level === this.#level && frame === this.#frame) return values;
		this.#level = level;
		this.#frame = frame;
		const { length } = temporal;
		if (values.length !== length) values = this.#values = new Float32Array(length);
		const center = 0.5 * (1 - level);
		for (let index = 0; index < length; index++) values[index] = temporal[index] * level + center;
		return values;
	}
}
//#endregion
