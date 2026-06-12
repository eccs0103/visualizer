"use strict";

import "adaptive-extender/core";

//#region Scene definition
export enum Scene {
	silence = "Silence",
	speech = "Speech",
	ambient = "Ambient",
	buildup = "Buildup",
	beat = "Beat",
	drop = "Drop"
}

export class SceneDefinition {
	static #values: readonly Scene[] = Object.freeze(Object.values(Scene));

	static get count(): number { return SceneDefinition.#values.length; }
	static get names(): readonly string[] { return SceneDefinition.#values; }
	static get values(): readonly Scene[] { return SceneDefinition.#values; }

	static nameOf(scene: Scene): string { return scene; }
	static indexOf(scene: Scene): number { return SceneDefinition.#values.indexOf(scene); }
	static fromIndex(index: number): Scene { return SceneDefinition.#values[index]; }
}
//#endregion
//#region SAB layout
/**
 *inSAB layout:  
 *  Bytes  0–7 : Int32[2]   → [frameCounter, length]  
 *  Bytes  8–19: Float32[3] → [sampleRate, volume, amplitude]  
 *  Bytes 20.. : Float32[inputMaxLength] dataFrequency  
 *             + Float32[inputMaxLength] dataTemporal  
 *
 *outSAB layout (Float32Array of outputSize = 22 + N floats, N = SceneDefinition.count):
 *  [0]     frameCounter
 *  [1]     spectralFlux
 *  [2–7]   bandEnergy[6]  (subBass, bass, lowMid, mid, highMid, high)
 *  [8]     zeroCrossingRate
 *  [9]     spectralCentroid
 *  [10]    percussiveness
 *  [11]    beatDetected   (0 | 1)
 *  [12]    scene          (scene index 0..N-1)
 *  [13..13+N-1] sceneProbs[N]
 *  [13+N]  dropIntensity
 *  [13+N+1] bassLevel
 *  [13+N+2] distortionLevel
 *  [13+N+3] dspScene     (-1 = no confident label, 0..N-1 = DSP label)
 *  [13+N+4] rlFocus      (sigmoid 0..1, mapped to focus range)
 *  [13+N+5] rlSpread     (sigmoid 0..1, mapped to spread range)
 *  [13+N+6] rlIntensity  (sigmoid 0..1)
 *  [13+N+7] rlColorShift (sigmoid 0..1)
 *  [13+N+8] rlReward     (current frame reward signal)
 */
export class SabLayout {
	static #inputMaxLength: number = 16384;

	static get inputMaxLength(): number { return SabLayout.#inputMaxLength; }
	static get outputSize(): number { return 22 + SceneDefinition.count; }

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
	#probabilities: Map<Scene, number> = new Map(SceneDefinition.values.map(scene => [scene, 0]));
	#dropIntensity: number = 0;
	#bassLevel: number = 0;
	#distortionLevel: number = 0;
	#dspScene: number = -1;
	#rlFocusNorm: number = 0.5;
	#rlSpreadNorm: number = 0.5;
	#rlIntensity: number = 0.5;
	#rlColorShift: number = 0.5;
	#rlReward: number = 0;

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
	get rlFocus(): number { return -80 + 42 * this.#rlFocusNorm; }
	get rlSpread(): number { return 20 + 20 * this.#rlSpreadNorm; }
	get rlIntensity(): number { return this.#rlIntensity; }
	get rlColorShift(): number { return this.#rlColorShift; }
	get rlReward(): number { return this.#rlReward; }

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
		this.#scene = SceneDefinition.fromIndex(out[12]);
		const scenes = SceneDefinition.values;
		for (const [index, scene] of scenes.entries()) this.#probabilities.set(scene, out[13 + index]);
		const endScene = 13 + scenes.length;
		this.#dropIntensity = out[endScene];
		this.#bassLevel = out[endScene + 1];
		this.#distortionLevel = out[endScene + 2];
		this.#dspScene = out[endScene + 3];
		this.#rlFocusNorm = out[endScene + 4];
		this.#rlSpreadNorm = out[endScene + 5];
		this.#rlIntensity = out[endScene + 6];
		this.#rlColorShift = out[endScene + 7];
		this.#rlReward = out[endScene + 8];
	}
}
//#endregion
