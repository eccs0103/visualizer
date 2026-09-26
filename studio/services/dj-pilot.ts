"use strict";

import "adaptive-extender/worker";
import { type Calibration } from "../models/calibration.js";
import { NNAgent } from "../models/nn-agent.js";
import { type PolicyUpdater } from "./policy-updater.js";

const { abs, max, min, trunc } = Math;

//#region DJ pilot
/**
 * The self-teaching DJ: a small reinforcement-learning network that turns the analyser knobs
 * (focus, spread, boost, tilt, punch) from the features `FrameProcessor` already wrote.
 * Paused by default — its reward is hand-made, with no ground truth to learn from — and only
 * activated when the studio is opened with `?dj`. Kept whole so it can be resumed or retrained.
 *
 * Reads output slots [1–13] (analysis) and writes [15–19] (knob deltas) and [20] (reward).
 */
export class DjPilot {
	static #featCount: number = 10;
	static #histSize: number = 32;
	static #holdStep: number = 64;
	static #maxGain: number = 15;
	static #scaleHeuristic: number = 0.2;

	// Per-feature normalization — identity (mean 0, std 1) until calibration loads,
	// then the fixed corpus stats: no cold start, no raw garbage for the first frames of a song.
	#means: Float32Array = new Float32Array(DjPilot.#featCount);
	#deviations: Float32Array = new Float32Array(DjPilot.#featCount).fill(1);

	#rawFeats: Float32Array = new Float32Array(DjPilot.#featCount);
	#normBuf: Float32Array = new Float32Array(DjPilot.#featCount);
	#featHistory: Float32Array = new Float32Array(DjPilot.#histSize * DjPilot.#featCount);
	#lastControlOutput: Float32Array = new Float32Array(NNAgent.sizeControl);
	#lastValueOutput: Float32Array = new Float32Array(1);
	#frameCount: number = 0;
	#sign: number = 0;
	#hold: number = 0;
	#engaged: boolean = false;
	#active: boolean = false;

	get active(): boolean { return this.#active; }
	set active(value: boolean) { this.#active = value; }

	injectFeedback(sign: number): void {
		if (sign !== this.#sign) {
			this.#sign = sign;
			this.#hold = 0;
		}
		if (sign !== 0) this.#engaged = true;
	}

	loadCalibration(calibration: Calibration): void {
		if (calibration.means.length !== DjPilot.#featCount || calibration.deviations.length !== DjPilot.#featCount) return;
		this.#means.set(calibration.means);
		for (let index = 0; index < DjPilot.#featCount; index++) this.#deviations[index] = max(calibration.deviations[index], 1e-6);
	}

	/** Clears the DJ slots so the audioset reads the neutral knob defaults. */
	silence(output: Float32Array): void {
		output.fill(0, 15, 21);
	}

	#fillInput(output: Float32Array): void {
		const raw = this.#rawFeats;
		raw[0] = output[1];
		for (let bandIndex = 0; bandIndex < 6; bandIndex++) raw[1 + bandIndex] = output[2 + bandIndex];
		raw[7] = output[8];
		raw[8] = output[9];
		raw[9] = output[10];

		const mean = this.#means, standardDeviation = this.#deviations;
		const norm = this.#normBuf;
		for (let index = 0; index < DjPilot.#featCount; index++) {
			norm[index] = (raw[index] - mean[index]) / standardDeviation[index];
		}
	}

	#pushHistory(): void {
		const hist = this.#featHistory, count = DjPilot.#featCount;
		hist.copyWithin(0, count);
		hist.set(this.#normBuf, (DjPilot.#histSize - 1) * count);
	}

	#computeFeedbackGain(sign: number): number {
		if (sign === 0) return 0;
		const hold = this.#hold;
		this.#hold = hold + 1;
		const step = trunc(hold / DjPilot.#holdStep) + 1;
		const gain = step * (step + 1) / 2;
		return gain.clamp(0, DjPilot.#maxGain);
	}

	#computeBeatReward(beatDetected: boolean, engagement: number): number {
		if (!beatDetected) return 0;
		if (engagement > 0.3) return 1;
		return -0.5;
	}

	#computeRlReward(sign: number, controlOutput: Float32Array, bassLevel: number, dropIntensity: number, percussiveness: number, beatDetected: boolean): number {
		// While a thumb is held, the human signal is the sole reward — fully authoritative
		if (sign !== 0) return sign.clamp(-1, 1);

		// Composite audio energy: how energetic is this frame
		const audioEnergy = min(1, bassLevel * 0.5 + dropIntensity * 0.3 + percussiveness * 0.2);

		// DJ engagement: average absolute control delta — how much is the AI doing
		let engagement = 0;
		for (let param = 0; param < NNAgent.sizeControl; param++) engagement += abs(controlOutput[param]);
		engagement /= NNAgent.sizeControl;

		// rSync: engagement should match audio energy (quiet = low engagement, loud = high)
		const rSync = 1 - 2 * abs(engagement - audioEnergy);

		// rBeat: engagement should spike on beats
		const rBeat = this.#computeBeatReward(beatDetected, engagement);

		const rBase = 0.8 * rSync + 0.2 * rBeat;

		// After the user has given feedback at least once, soften the heuristic so taught
		// behavior is not slowly overwritten when no thumb is held
		if (this.#engaged) return rBase * DjPilot.#scaleHeuristic;
		return rBase;
	}

	/** Runs one frame of the DJ over the analysis `FrameProcessor` just wrote into `output`. */
	step(output: Float32Array, model: NNAgent, policy: PolicyUpdater): void {
		this.#frameCount++;
		this.#fillInput(output);
		this.#pushHistory();

		const featHistory = this.#featHistory;
		const lastControlOutput = this.#lastControlOutput;
		const lastValueOutput = this.#lastValueOutput;
		model.forwardControl(featHistory, lastControlOutput, lastValueOutput);
		for (let param = 0; param < NNAgent.sizeControl; param++) output[15 + param] = lastControlOutput[param];

		const percussiveness = output[10];
		const beatDetected = output[11] > 0;
		const dropIntensity = output[12];
		const bassLevel = output[13];

		const sign = this.#sign;
		const gain = this.#computeFeedbackGain(sign);
		const reward = this.#computeRlReward(sign, lastControlOutput, bassLevel, dropIntensity, percussiveness, beatDetected);
		output[20] = reward;

		policy.consider(featHistory, lastControlOutput, lastValueOutput[0], reward, model, this.#frameCount, sign, gain);
	}
}
//#endregion
