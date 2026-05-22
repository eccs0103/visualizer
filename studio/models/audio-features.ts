"use strict";

import "adaptive-extender/core";

//#region Scene definition
export enum Scene {
	silence,
	speech,
	ambient,
	buildup,
	beat,
	drop
}

export class SceneDefinition {
	static #names: readonly string[] = Object.freeze(["Silence", "Speech", "Ambient", "Buildup", "Beat", "Drop"]);

	static get count(): number { return SceneDefinition.#names.length; }
	static get names(): readonly string[] { return SceneDefinition.#names; }

	static nameOf(scene: Scene): string {
		return ReferenceError.suppress(SceneDefinition.#names[scene], "Unknown scene");
	}
}
//#endregion
//#region SAB layout
/**
 *inSAB layout:  
 *  Bytes  0–7 : Int32[2]   → [frameCounter, length]  
 *  Bytes  8–19: Float32[3] → [sampleRate, normVolume, normAmplitude]  
 *  Bytes 20.. : Float32[inputMaxLength] normsDataFrequency  
 *             + Float32[inputMaxLength] normsDataTemporal  
 *
 *outSAB layout (Float32Array of outputSize floats):  
 *  [0]     frameCounter  
 *  [1]     spectralFlux  
 *  [2–7]   bandEnergy[6]  (subBass, bass, lowMid, mid, highMid, high)  
 *  [8]     zeroCrossingRate  
 *  [9]     spectralCentroid  
 *  [10]    percussiveness  
 *  [11]    beatDetected   (0 | 1)  
 *  [12]    scene          (0–5)  
 *  [13–18] sceneProbs[6]  
 *  [19]    dropIntensity  
 *  [20]    bassLevel  
 *  [21]    distortionLevel  
 *  [22]    dspScene       (-1 = no confident label, 0–5 = DSP label)  
 */
export class SabLayout {
	static #inputMaxLength: number = 16384;
	static #outputSize: number = 23;

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
	#scene: Scene = Scene.silence;
	#probabilities: Map<Scene, number> = new Map([
		[Scene.silence, 0],
		[Scene.speech, 0],
		[Scene.ambient, 0],
		[Scene.buildup, 0],
		[Scene.beat, 0],
		[Scene.drop, 0],
	]);
	#dropIntensity: number = 0;
	#bassLevel: number = 0;
	#distortionLevel: number = 0;
	#dspScene: number = -1;

	get spectralFlux(): number { return this.#spectralFlux; }
	get bandEnergy(): BandEnergy { return this.#bandEnergy; }
	get zeroCrossingRate(): number { return this.#zeroCrossingRate; }
	get spectralCentroid(): number { return this.#spectralCentroid; }
	get percussiveness(): number { return this.#percussiveness; }
	get beatDetected(): boolean { return this.#beatDetected; }
	get scene(): Scene { return this.#scene; }
	get confidence(): number { return this.#probabilities.get(this.#scene) ?? NaN; }
	get probabilities(): ReadonlyMap<Scene, number> { return this.#probabilities; }
	get dropIntensity(): number { return this.#dropIntensity; }
	get bassLevel(): number { return this.#bassLevel; }
	get distortionLevel(): number { return this.#distortionLevel; }
	get dspScene(): number { return this.#dspScene; }

	isActive(): boolean {
		return this.#scene !== Scene.silence;
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
		this.#scene = out[12];
		this.#probabilities.set(Scene.silence, out[13]);
		this.#probabilities.set(Scene.speech, out[14]);
		this.#probabilities.set(Scene.ambient, out[15]);
		this.#probabilities.set(Scene.buildup, out[16]);
		this.#probabilities.set(Scene.beat, out[17]);
		this.#probabilities.set(Scene.drop, out[18]);
		this.#dropIntensity = out[19];
		this.#bassLevel = out[20];
		this.#distortionLevel = out[21];
		this.#dspScene = out[22];
	}
}
//#endregion
