"use strict";

import "adaptive-extender/worker";
import { Color } from "adaptive-extender/worker";
import { Registry, Visualization } from "../../services/visualization-registry.js";
import { type Audioset, type Host } from "../../models/visualization.js";
import { type Curve, Shaper, StemMix } from "../../services/visualization-tools.js";

const { min, max, abs, exp, sin, cos, trunc, PI } = Math;

//#region Stem ring
class StemRing {
	static #count: number = 192;
	static #reach: number = 0.14;
	static #gain: number = 2;
	static #lag: number = 0.15;
	static #faint: number = 0.1;
	static #clear: number = 0.35;
	static #ghost: number = 0.15;
	static #shaper: Shaper = Shaper.sigmoid().then(Shaper.arcsinSaturate);
	static #sines: Float32Array = StemRing.#tabulate(sin);
	static #cosines: Float32Array = StemRing.#tabulate(cos);
	static #fractions: Float32Array = StemRing.#spread();

	#name: string;
	#hue: number;
	#saturation: number;
	#offset: number;
	#mix: StemMix;
	#share: number = 0;
	#radius: number;
	#width: number;
	#blur: number;
	#color: Color;
	#stroke: string;
	#glow: string;
	#path: Path2D = new Path2D();

	constructor(name: string, hue: number, saturation: number, offset: number, mix: StemMix) {
		this.#name = name;
		this.#hue = hue;
		this.#saturation = saturation;
		this.#offset = offset;
		this.#mix = mix;
	}

	static #tabulate(wave: Curve): Float32Array {
		const count = StemRing.#count;
		const table = new Float32Array(count);
		for (let index = 0; index < count; index++) table[index] = wave(index.lerp(0, count) * 2 * PI);
		return table;
	}

	static #spread(): Float32Array {
		const count = StemRing.#count;
		const table = new Float32Array(count);
		for (let index = 0; index < count; index++) {
			const normOffset = abs(index.lerp(0, count) - 0.5) * 2;
			table[index] = (exp(normOffset * 3) - 1) / (exp(3) - 1);
		}
		return table;
	}

	get name(): string { return this.#name; }
	get share(): number { return this.#share; }
	get color(): Color { return this.#color; }

	get #presence(): number {
		const faint = StemRing.#faint;
		const clear = StemRing.#clear;
		return Shaper.smoothstep.apply(this.#share.clamp(faint, clear).lerp(faint, clear));
	}

	fit(radius: number, side: number, dark: boolean): void {
		const hue = this.#hue;
		const saturation = this.#saturation;

		this.#radius = radius;
		this.#width = max(1, side >> 8);
		this.#blur = dark ? side >> 6 : side >> 7;
		const color = this.#color = dark ? Color.fromHSL(hue, saturation, 62) : Color.fromHSL(hue, saturation * 0.9, 38);
		const stroke = this.#stroke = color.toString();
		this.#glow = dark ? stroke : Color.fromHSL(hue, saturation, 15, 0.45).toString();
	}

	#follow(spectrum: Float32Array, total: number, delta: number): void {
		const previous = this.#share;
		let sum = 0;
		for (let index = 0; index < spectrum.length; index++) sum += spectrum[index];
		const share = total > 0 ? sum / total : 0;
		const step = Number.isFinite(delta) && delta > 0 ? 1 - exp(-delta / StemRing.#lag) : 0;
		this.#share = previous + (share - previous) * step;
	}

	#trace(spectrum: Float32Array): void {
		const count = StemRing.#count;
		const sines = StemRing.#sines;
		const cosines = StemRing.#cosines;
		const fractions = StemRing.#fractions;
		const shaper = StemRing.#shaper;
		const gain = StemRing.#gain;
		const radius = this.#radius;
		const { length } = spectrum;
		const base = this.#offset * radius;
		const span = StemRing.#reach * radius;

		const path = this.#path = new Path2D();
		for (let index = 0; index < count; index++) {
			const value = spectrum[trunc(fractions[index] * (length - 1))];
			const distance = base + shaper.apply(min(1, value * gain)) * span;
			path.lineTo(distance * sines[index], distance * cosines[index]);
		}
		path.closePath();
	}

	update(audioset: Audioset, total: number, delta: number): void {
		const spectrum = this.#mix.mix(audioset);
		this.#follow(spectrum, total, delta);
		this.#trace(spectrum);
	}

	draw(host: Host): void {
		const presence = this.#presence;
		const { context } = host;

		context.globalAlpha = presence.lerp(0, 1, StemRing.#ghost, 1);
		context.lineWidth = this.#width;
		context.lineJoin = "round";
		context.strokeStyle = this.#stroke;
		context.shadowColor = this.#glow;
		context.shadowBlur = presence * this.#blur;
		context.stroke(this.#path);
	}

	mark(context: OffscreenCanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
		context.globalAlpha = this.#presence.lerp(0, 1, StemRing.#ghost, 1);
		context.fillStyle = this.#stroke;
		context.fillRect(x, y, width, height);
	}

	label(context: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
		context.globalAlpha = this.#presence.lerp(0, 1, 0.45, 1);
		context.fillStyle = this.#stroke;
		context.fillText(this.#name, x, y);
	}
}
//#endregion
//#region Stems
Registry.attach("Stems", class extends Visualization {
	#rings: StemRing[] = [
		new StemRing("Bass", 260, 100, 0.22, new StemMix(0, 1, 0, 0, 0, 0, 1)),
		new StemRing("Drums", 35, 100, 0.34, new StemMix(1, 0, 0, 0, 0, 0, 1)),
		new StemRing("Keys", 190, 100, 0.46, new StemMix(0, 0, 0, 0, 1, 0, 1)),
		new StemRing("Guitar", 130, 100, 0.58, new StemMix(0, 0, 0, 1, 0, 0, 1)),
		new StemRing("Vocals", 320, 100, 0.70, new StemMix(0, 0, 1, 0, 0, 0, 1)),
		new StemRing("Other", 0, 0, 0.82, new StemMix(0, 0, 0, 0, 0, 1, 1)),
	];
	#scale: number = 0.4;
	#side: number;
	#radius: number;
	#haze: number;
	#heat: number;
	#core: number = 0;
	#color: Color | null = null;

	constructor() {
		super();
		this.newLayer("Ambient", this.#drawAmbient.bind(this));
		this.newLayer("Core", this.#drawCore.bind(this));
		for (const ring of this.#rings) this.newLayer(ring.name, ring.draw.bind(ring));
		this.newLayer("Legend", this.#drawLegend.bind(this));
	}

	//#region Rebuild
	rebuild(host: Host): void {
		const { context, environment } = host;
		const { width, height } = context.canvas;
		const dark = environment.colorBackground.lightness < 50;

		const side = this.#side = min(width, height);
		const radius = this.#radius = side * this.#scale;
		this.#haze = dark ? 0.25 : 0.12;
		this.#heat = dark ? 0.6 : 0;
		for (const ring of this.#rings) ring.fit(radius, side, dark);
	}
	//#endregion
	//#region Update
	#runRings(host: Host): void {
		const { audioset, environment } = host;
		const { delta } = environment;
		const { dataFrequency, length } = audioset;

		let total = 0;
		for (let index = 0; index < length; index++) total += dataFrequency[index];
		for (const ring of this.#rings) ring.update(audioset, total, delta);
	}

	#runAmbient(): void {
		let color: Color | null = null;
		let weight = 0;
		for (const ring of this.#rings) {
			const { share } = ring;
			if (share <= 0) continue;
			weight += share;
			color = color === null ? ring.color : Color.mix(color, ring.color, share / weight);
		}
		if (color === null) return;
		this.#color = color;
	}

	#runCore(host: Host): void {
		const { volume } = host.audioset;

		this.#core = this.#radius * volume.clamp(0, 0.4).lerp(0, 0.4, 0.06, 0.14);
	}

	update(host: Host): void {
		if (host.audioset.length === 0) return;
		this.#runRings(host);
		this.#runAmbient();
		this.#runCore(host);
	}
	//#endregion
	//#region Layers
	#drawAmbient(host: Host): void {
		const color = this.#color;
		const { context } = host;
		const { width, height } = context.canvas;
		if (color === null) return;

		const gradient = context.createRadialGradient(0, 0, 0, 0, 0, max(width, height) * 0.75);
		gradient.addColorStop(0, new Color(color).pass(this.#haze).toString());
		gradient.addColorStop(1, new Color(color).pass(0).toString());
		context.fillStyle = gradient;
		context.fillRect(-width, -height, width * 2, height * 2);
	}

	#drawCore(host: Host): void {
		const color = this.#color;
		const glow = this.#core * 2.5;
		const { context } = host;
		if (color === null || glow <= 0) return;

		const gradient = context.createRadialGradient(0, 0, 0, 0, 0, glow);
		gradient.addColorStop(0, Color.mix(color, Color.newWhite, this.#heat).toString());
		gradient.addColorStop(0.4, new Color(color).pass(0.85).toString());
		gradient.addColorStop(1, new Color(color).pass(0).toString());
		context.fillStyle = gradient;
		context.beginPath();
		context.arc(0, 0, glow, 0, 2 * PI);
		context.fill();
	}

	#drawLegend(host: Host): void {
		const rings = this.#rings;
		const side = this.#side;
		const { context } = host;
		const { width, height } = context.canvas;
		const span = side * 0.9;
		const left = (width - span) / 2;
		const middle = height / 2;
		const top = middle + side * 0.425;
		const thickness = max(2, side >> 7);
		const slot = span / rings.length;

		context.resetTransform();
		context.font = `${trunc(side / 36)}px sans-serif`;
		context.textAlign = "center";
		let x = left;
		for (let index = 0; index < rings.length; index++) {
			const ring = rings[index];
			const segment = ring.share * span;
			ring.mark(context, x, top, segment, thickness);
			ring.label(context, left + slot * (index + 0.5), middle + side * 0.47);
			x += segment;
		}
	}
	//#endregion
});
//#endregion
