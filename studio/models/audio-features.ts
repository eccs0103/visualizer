"use strict";

import "adaptive-extender/core";

const { max } = Math;

//#region SAB layout
/**
 * inSAB layout:
 *   Bytes  0–7 : Int32[2]   → [frameCounter, length]
 *   Bytes  8–19: Float32[3] → [sampleRate, volume, amplitude]
 *   Bytes 20.. : Float32[inputMaxLength] dataFrequency
 *              + Float32[inputMaxLength] dataTemporal
 *
 * outSAB layout (Float32Array of outputSize = 21 floats):
 *   [0]     frameCounter
 *   [1]     spectralFlux
 *   [2–7]   bandEnergy[6]  (subBass, bass, lowMid, mid, highMid, high)
 *   [8]     zeroCrossingRate
 *   [9]     spectralCentroid
 *   [10]    percussiveness
 *   [11]    beatDetected   (0 | 1)
 *   [12]    dropIntensity
 *   [13]    bassLevel
 *   [14]    distortionLevel
 *   [15–19] djControl[5]   (bipolar tanh deltas: focus, spread, boost, tilt, punch)
 *   [20]    reward         (diagnostic)
 */
export class SabLayout {
	static #inputMaxLength: number = 16384;
	static #outputSize: number = 21;

	static get inputMaxLength(): number { return SabLayout.#inputMaxLength; }
	static get outputSize(): number { return SabLayout.#outputSize; }

	static inputByteSize(): number {
		return 20 + SabLayout.#inputMaxLength * 4 * 2;
	}
}
//#endregion
//#region Band energy
export class BandEnergy {
	#subBass: number = 0;
	#bass: number = 0;
	#lowMid: number = 0;
	#mid: number = 0;
	#highMid: number = 0;
	#high: number = 0;

	get subBass(): number { return this.#subBass; }
	get bass(): number { return this.#bass; }
	get lowMid(): number { return this.#lowMid; }
	get mid(): number { return this.#mid; }
	get highMid(): number { return this.#highMid; }
	get high(): number { return this.#high; }

	total(): number {
		return this.#subBass + this.#bass + this.#lowMid + this.#mid + this.#highMid + this.#high;
	}

	bassWeight(): number {
		const total = this.total();
		if (total === 0) return 0;
		return (this.#subBass + this.#bass) / total;
	}

	readFrom(out: Float32Array, offset: number): void {
		this.#subBass = out[offset];
		this.#bass = out[offset + 1];
		this.#lowMid = out[offset + 2];
		this.#mid = out[offset + 3];
		this.#highMid = out[offset + 4];
		this.#high = out[offset + 5];
	}
}
//#endregion
//#region Audio features
export class AudioFeatures {
	#spectralFlux: number = 0;
	#bandEnergy: BandEnergy = new BandEnergy();
	#zeroCrossingRate: number = 0;
	#spectralCentroid: number = 0;
	#percussiveness: number = 0;
	#beatDetected: boolean = false;
	#dropIntensity: number = 0;
	#bassLevel: number = 0;
	#distortionLevel: number = 0;
	#djControl: Float32Array = new Float32Array(5);
	#reward: number = 0;

	get spectralFlux(): number { return this.#spectralFlux; }
	get bandEnergy(): BandEnergy { return this.#bandEnergy; }
	get zeroCrossingRate(): number { return this.#zeroCrossingRate; }
	get spectralCentroid(): number { return this.#spectralCentroid; }
	get percussiveness(): number { return this.#percussiveness; }
	get beatDetected(): boolean { return this.#beatDetected; }
	get dropIntensity(): number { return this.#dropIntensity; }
	get bassLevel(): number { return this.#bassLevel; }
	get distortionLevel(): number { return this.#distortionLevel; }

	// DJ control outputs — bipolar delta d ∈ [-1, 1] mapped to parameter space.
	// A freshly-initialized network outputs d ≈ 0 (tanh(0) = 0), keeping every param at its default.
	get djFocus(): number { return this.#djControl[0].lerp(-1, 1, -100, -20); }  // default –60 dB, range [–100, –20]
	get djSpread(): number { return this.#djControl[1].lerp(-1, 1, 1, 59); }     // default 30 dB, range [1, 59]
	get djBoost(): number { return this.#djControl[2].lerp(-1, 1, 0.25, 1.75); } // default 1.0×, range [0.25, 1.75]
	get djTilt(): number { return this.#djControl[3].lerp(-1, 1, -12, 12); }     // default 0 dB, range [–12, +12]
	get djPunch(): number { return max(0, this.#djControl[4]); }                  // default 0 (transparent), range [0, 1]
	get reward(): number { return this.#reward; }

	isActive(): boolean {
		return this.#bassLevel > 0.05 || this.#percussiveness > 0.1 || this.#spectralFlux > 0.02;
	}

	isPercussive(): boolean {
		return this.#percussiveness > 0.5;
	}

	readFrom(out: Float32Array): void {
		this.#spectralFlux = out[1];
		this.#bandEnergy.readFrom(out, 2);
		this.#zeroCrossingRate = out[8];
		this.#spectralCentroid = out[9];
		this.#percussiveness = out[10];
		this.#beatDetected = out[11] > 0.5;
		this.#dropIntensity = out[12];
		this.#bassLevel = out[13];
		this.#distortionLevel = out[14];
		for (let index = 0; index < 5; index++) this.#djControl[index] = out[15 + index];
		this.#reward = out[20];
	}
}
//#endregion
