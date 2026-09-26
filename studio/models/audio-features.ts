"use strict";

import "adaptive-extender/core";

const { max, min } = Math;

//#region SAB layout
/**
 * inSAB layout:
 *   Bytes  0–7 : Int32[2]   → [frameCounter, length]
 *   Bytes  8–19: Float32[3] → [sampleRate, volume, amplitude]
 *   Bytes 20.. : Float32[inputMaxLength] dataFrequency
 *              + Float32[inputMaxLength] dataTemporal
 *              + Float32[bins]           dataModel — fixed-settings analysis tap,
 *                untouched by quality/DJ, read by stem-mask-worker only
 *
 * outSAB layout (Float32Array of outputSize = 81 floats):
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
 *   [21–80] four thread blocks of 15 floats (drums, bass, vocals, other): the same analysis
 *           as slots [0–14], run on that thread's spectrum (mix × mask) — see stemOffset()
 *
 * mask SAB layout (written by stem-mask-worker.ts through StemMasks.publish):
 *   Bytes  0–3 : Int32[1]                        version counter
 *   Bytes  8–23: Float64[2]                      [stamp, interval] — epoch ms of the latest
 *                                                publication and the gap since the one before
 *   Bytes 24.. : Float32[bins * stems] previous masks, then Float32[bins * stems] current masks,
 *                each bin-major/stem-minor (mask[bin*stems+stem], stem order
 *                drums/bass/vocals/other, sums to ~1 per bin)
 */
export class SabLayout {
	static #inputMaxLength: number = 16384;
	static #bins: number = 512;
	static #outputSize: number = 81;
	static #stemBlock: number = 15;
	static #stems: number = 4;

	static get inputMaxLength(): number { return SabLayout.#inputMaxLength; }
	static get bins(): number { return SabLayout.#bins; }
	static get outputSize(): number { return SabLayout.#outputSize; }
	static get stems(): number { return SabLayout.#stems; }

	static inputByteSize(): number {
		return 20 + SabLayout.#inputMaxLength * 4 * 2 + SabLayout.#bins * 4;
	}

	/** First slot of a thread's analysis block in outSAB; the block has the same layout as slots [0–14]. */
	static stemOffset(stem: number): number {
		return 21 + stem * SabLayout.#stemBlock;
	}

	static get stemBlock(): number { return SabLayout.#stemBlock; }

	static maskBytes(): number {
		return 24 + SabLayout.#bins * SabLayout.#stems * 4 * 2;
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
//#region Stem masks
/**
 * A view over the mask SAB — owns resampling the fixed `bins`-bin mask onto
 * whatever `length` the main analyser is using (linear interpolation: both are
 * linear FFT bins over 0..Nyquist, so this is exact, not an approximation) and
 * multiplying by `dataFrequency` to produce an isolated-stem spectrum. Computed
 * lazily per stem, cached until the blended masks or the requested length change —
 * a visualization using one stem never pays to resample the other three.
 *
 * The model publishes a few times per second, so the masks are not read raw: each
 * frame blends the previous publication into the current one over the measured gap
 * between them (`invalidate`), which keeps every stem moving at the render rate.
 * The blend trails the model by one publication interval — it shows the model's own
 * output, smoothed in time, never a prediction of what it will say next.
 *
 * The blended masks are then squared and renormalised per bin (a Wiener-style power 2):
 * the model's softmax cannot say a stem is absent — on frames with no vocals it still
 * hands vocals ~10% of the spectrum — and squaring roughly halves that floor. Measured on
 * MUSDB18HQ test tracks, powers 2 to 6 cut the false share about the same, and power 2
 * costs the least correlation with the true stems.
 */
export class StemMasks {
	static #drums: number = 0;
	static #bass: number = 1;
	static #vocals: number = 2;
	static #other: number = 3;
	static #ceiling: number = 500; // ms — a longer gap (paused audio) must not stretch the next blend

	#control: Int32Array;
	#timing: Float64Array;
	#previous: Float32Array;
	#current: Float32Array;
	#blended: Float32Array = new Float32Array(SabLayout.bins * SabLayout.stems);
	#version: number = -1;
	#weight: number = -1;
	#length: number = -1;
	#cache: Float32Array[] = [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)];
	#fresh: boolean[] = [false, false, false, false];

	constructor(sabMask: SharedArrayBuffer) {
		const size = SabLayout.bins * SabLayout.stems;
		this.#control = new Int32Array(sabMask, 0, 1);
		this.#timing = new Float64Array(sabMask, 8, 2);
		this.#previous = new Float32Array(sabMask, 24, size);
		this.#current = new Float32Array(sabMask, 24 + size * 4, size);
		this.#blend(1);
	}

	/** A fresh mask buffer at the uniform 1/stems prior — an honest "no separation yet", not zeros. */
	static createBuffer(): SharedArrayBuffer {
		const sab = new SharedArrayBuffer(SabLayout.maskBytes());
		new Float32Array(sab, 24).fill(1 / SabLayout.stems);
		return sab;
	}

	/** Mask worker only: `masks` becomes the current masks, the old current ones become the previous, and `now` (epoch ms) starts the blend between them. */
	publish(masks: Float32Array, now: number): void {
		const timing = this.#timing;
		this.#previous.set(this.#current);
		this.#current.set(masks);
		timing[1] = timing[0] === 0 ? 0 : min(now - timing[0], StemMasks.#ceiling);
		timing[0] = now;
		Atomics.add(this.#control, 0, 1);
	}

	/** Call once per rendered frame — cheap: the blend is rebuilt only when a new version was published or the blend weight moved. */
	invalidate(now: number = performance.timeOrigin + performance.now()): void {
		const version = Atomics.load(this.#control, 0);
		const weight = this.#weightAt(now);
		if (version === this.#version && weight === this.#weight) return;
		this.#version = version;
		this.#weight = weight;
		this.#blend(weight);
		this.#fresh.fill(false);
	}

	#weightAt(now: number): number {
		const [stamp, interval] = this.#timing;
		if (interval <= 0) return 1;
		return ((now - stamp) / interval).clamp(0, 1);
	}

	#blend(weight: number): void {
		const previous = this.#previous, current = this.#current, blended = this.#blended;
		const stems = SabLayout.stems;
		for (let bin = 0; bin < SabLayout.bins; bin++) {
			const base = bin * stems;
			let sum = 1e-12;
			for (let stem = 0; stem < stems; stem++) {
				const mask = previous[base + stem] + (current[base + stem] - previous[base + stem]) * weight;
				blended[base + stem] = mask * mask;
				sum += mask * mask;
			}
			for (let stem = 0; stem < stems; stem++) blended[base + stem] /= sum;
		}
	}

	drums(length: number, whole: Float32Array): Float32Array { return this.#spectrum(StemMasks.#drums, length, whole); }
	bass(length: number, whole: Float32Array): Float32Array { return this.#spectrum(StemMasks.#bass, length, whole); }
	vocals(length: number, whole: Float32Array): Float32Array { return this.#spectrum(StemMasks.#vocals, length, whole); }
	other(length: number, whole: Float32Array): Float32Array { return this.#spectrum(StemMasks.#other, length, whole); }

	#spectrum(stem: number, length: number, whole: Float32Array): Float32Array {
		if (this.#length !== length) {
			this.#length = length;
			this.#fresh.fill(false);
		}
		if (this.#fresh[stem]) return this.#cache[stem];
		let target = this.#cache[stem];
		if (target.length !== length) target = this.#cache[stem] = new Float32Array(length);
		this.#interpolate(stem, length, whole, target);
		this.#fresh[stem] = true;
		return target;
	}

	#interpolate(stem: number, length: number, whole: Float32Array, out: Float32Array): void {
		const masks = this.#blended;
		const stems = SabLayout.stems;
		const bins = SabLayout.bins;
		const scale = (bins - 1) / max(1, length - 1);
		for (let index = 0; index < length; index++) {
			const position = index * scale;
			const bin = position | 0;
			const nextBin = min(bin + 1, bins - 1);
			const weight = position - bin;
			const mask = masks[bin * stems + stem] * (1 - weight) + masks[nextBin * stems + stem] * weight;
			out[index] = whole[index] * mask;
		}
	}
}
//#endregion
//#region Stem thread
/**
 * One of the four threads (drums, bass, vocals, other) as a plugin sees it: its isolated spectrum
 * plus the same analysis the mix gets — computed by audio-analyzer-worker with FrameProcessor's
 * exact formulas on the thread's spectrum and read from its block in outSAB.
 */
export class StemThread {
	#spectrum: () => Float32Array;
	#spectralFlux: number = 0;
	#bandEnergy: BandEnergy = new BandEnergy();
	#spectralCentroid: number = 0;
	#percussiveness: number = 0;
	#beatDetected: boolean = false;
	#dropIntensity: number = 0;
	#bassLevel: number = 0;

	constructor(spectrum: () => Float32Array) {
		this.#spectrum = spectrum;
	}

	get dataFrequency(): Float32Array { return this.#spectrum(); }
	get spectralFlux(): number { return this.#spectralFlux; }
	get subBass(): number { return this.#bandEnergy.subBass; }
	get bass(): number { return this.#bandEnergy.bass; }
	get lowMid(): number { return this.#bandEnergy.lowMid; }
	get mid(): number { return this.#bandEnergy.mid; }
	get highMid(): number { return this.#bandEnergy.highMid; }
	get high(): number { return this.#bandEnergy.high; }
	get spectralCentroid(): number { return this.#spectralCentroid; }
	get percussiveness(): number { return this.#percussiveness; }
	get beatDetected(): boolean { return this.#beatDetected; }
	get dropIntensity(): number { return this.#dropIntensity; }
	get bassLevel(): number { return this.#bassLevel; }

	/** Total band energy — how much of this thread is sounding, on the same scale as the band getters. */
	get energy(): number { return this.#bandEnergy.total(); }

	readFrom(out: Float32Array, offset: number): void {
		this.#spectralFlux = out[offset + 1];
		this.#bandEnergy.readFrom(out, offset + 2);
		this.#spectralCentroid = out[offset + 9];
		this.#percussiveness = out[offset + 10];
		this.#beatDetected = out[offset + 11] > 0.5;
		this.#dropIntensity = out[offset + 12];
		this.#bassLevel = out[offset + 13];
	}
}
//#endregion
//#region Stem threads
export class StemThreads {
	#drums: StemThread;
	#bass: StemThread;
	#vocals: StemThread;
	#other: StemThread;

	constructor(masks: () => StemMasks, length: () => number, whole: () => Float32Array) {
		this.#drums = new StemThread(() => masks().drums(length(), whole()));
		this.#bass = new StemThread(() => masks().bass(length(), whole()));
		this.#vocals = new StemThread(() => masks().vocals(length(), whole()));
		this.#other = new StemThread(() => masks().other(length(), whole()));
	}

	get drums(): StemThread { return this.#drums; }
	get bass(): StemThread { return this.#bass; }
	get vocals(): StemThread { return this.#vocals; }
	get other(): StemThread { return this.#other; }

	readFrom(out: Float32Array): void {
		this.#drums.readFrom(out, SabLayout.stemOffset(0));
		this.#bass.readFrom(out, SabLayout.stemOffset(1));
		this.#vocals.readFrom(out, SabLayout.stemOffset(2));
		this.#other.readFrom(out, SabLayout.stemOffset(3));
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
