"use strict";

import assert from "node:assert/strict";
import { test } from "node:test";
import { SabLayout, StemMasks } from "./audio-features.ts";

const { bins, stems } = SabLayout;

/** A mask buffer where every bin splits [drums, bass, vocals, other] the same way. */
function bufferOf(split: number[]): SharedArrayBuffer {
	const masks = new Float32Array(bins * stems);
	for (let bin = 0; bin < bins; bin++) masks.set(split, bin * stems);
	return publishedOf(masks);
}

/** A mask buffer whose first publication (no earlier one to blend from) is `masks`. */
function publishedOf(masks: Float32Array): SharedArrayBuffer {
	const sab = StemMasks.createBuffer();
	new StemMasks(sab).publish(masks, 1000);
	return sab;
}

function rampOf(length: number): Float32Array {
	return Float32Array.from({ length }, (_, index) => (index + 1) / length);
}

test("the four isolated spectra add back up to the whole spectrum, at any analyser length", () => {
	const masks = new StemMasks(bufferOf([0.1, 0.2, 0.3, 0.4]));
	for (const length of [300, 512, 2048]) {
		const whole = rampOf(length);
		const drums = masks.drums(length, whole), bass = masks.bass(length, whole), vocals = masks.vocals(length, whole), other = masks.other(length, whole);
		for (let index = 0; index < length; index++) assert.ok(Math.abs(drums[index] + bass[index] + vocals[index] + other[index] - whole[index]) < 1e-6, `length ${length}, index ${index}`);
	}
});

test("a fresh buffer is the uniform prior: every stem gets a quarter", () => {
	const masks = new StemMasks(StemMasks.createBuffer());
	const whole = rampOf(512);
	const bass = masks.bass(512, whole);
	for (let index = 0; index < 512; index++) assert.ok(Math.abs(bass[index] - whole[index] / stems) < 1e-6);
});

test("masks are interpolated linearly across bins when the analyser is longer than the model tap", () => {
	// One-hot masks (drums on even bins, bass on odd ones) are unchanged by the mask sharpening, so the interpolation stays visible on its own.
	const raw = new Float32Array(bins * stems);
	for (let bin = 0; bin < bins; bin++) raw.set(bin % 2 === 0 ? [1, 0, 0, 0] : [0, 1, 0, 0], bin * stems);
	const length = 2 * (bins - 1) + 1;
	const drums = new StemMasks(publishedOf(raw)).drums(length, new Float32Array(length).fill(1));
	for (let index = 0; index < length; index++) {
		const expected = index % 2 === 1 ? 0.5 : (index / 2) % 2 === 0 ? 1 : 0;
		assert.ok(Math.abs(drums[index] - expected) < 1e-6, `index ${index}`);
	}
});

test("the stems glide from the previous publication to the current one over the measured gap", () => {
	const sab = bufferOf([0.25, 0.25, 0.25, 0.25]);
	const reader = new StemMasks(sab);
	const whole = rampOf(512);
	const drumsOnly = new Float32Array(bins * stems);
	for (let bin = 0; bin < bins; bin++) drumsOnly.set([1, 0, 0, 0], bin * stems);
	new StemMasks(sab).publish(drumsOnly, 1100);
	const share = (now: number): number => {
		reader.invalidate(now);
		return reader.drums(512, whole)[100] / whole[100];
	};
	assert.ok(Math.abs(share(1100) - 0.25) < 1e-6, "just published: still the previous masks");
	assert.ok(Math.abs(share(1150) - 0.625 ** 2 / (0.625 ** 2 + 3 * 0.125 ** 2)) < 1e-6, "halfway through the gap: the midpoint, sharpened");
	assert.ok(Math.abs(share(1200) - 1) < 1e-6, "one gap later: the current masks");
	assert.ok(Math.abs(share(5000) - 1) < 1e-6, "and it holds there, never extrapolating past them");
});
