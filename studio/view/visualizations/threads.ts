"use strict";

import "adaptive-extender/worker";
import { Color } from "adaptive-extender/worker";
import { Registry, Visualization } from "../../services/visualization-registry.js";
import { type Audioset, type Host } from "../../models/visualization.js";
import { AutoRange, Shaper, StemMix } from "../../services/visualization-tools.js";

const { min, max, exp, sin, trunc, PI } = Math;

//#region Flow
class Flow {
	static #bend: number = 0.2;

	#turned: boolean;
	#half: number;
	#breadth: number;
	#side: number;
	#margin: number;

	constructor(width: number, height: number) {
		const turned = this.#turned = height > width;
		const side = this.#side = min(width, height);
		this.#half = (turned ? height : width) / 2;
		this.#breadth = turned ? width : height;
		this.#margin = side * (turned ? 0.2 : 0.14);
	}

	get turned(): boolean { return this.#turned; }
	get side(): number { return this.#side; }
	get breadth(): number { return this.#breadth; }
	get bend(): number { return this.#half * Flow.#bend; }
	get end(): number { return this.#half - this.#margin; }

	x(along: number, across: number): number {
		return this.#turned ? across : along;
	}

	y(along: number, across: number): number {
		return this.#turned ? -along : across;
	}
}
//#endregion
//#region Thread
class Thread {
	static #spacing: number = 0.12;
	static #calm: number = 1;
	static #rush: number = 10;
	static #sparks: number = 5;
	static #lag: number = 0.15;
	static #faint: number = 0.1;
	static #clear: number = 0.35;
	static #ghost: number = 0.85;
	static #shaper: Shaper = Shaper.sigmoid().then(Shaper.arcsinSaturate);

	#name: string;
	#base: Color;
	#lane: number;
	#direction: number;
	#part: StemMix;
	#gain: number;
	#share: number = 0;
	#intensity: AutoRange = new AutoRange(0.05, 0.4);
	#phase: number = 0;
	#color: Color;
	#stroke: string;
	#glow: string;
	#shade: string;
	#origin: string;
	#gradient: CanvasGradient | null = null;
	#flow: Flow;
	#width: number;
	#blur: number;
	#dot: number;
	#amplitude: number;
	#wavelength: number;
	#alongs: Float32Array = new Float32Array(0);
	#acrosses: Float32Array = new Float32Array(0);
	#fractions: Float32Array = new Float32Array(0);
	#tapers: Float32Array = new Float32Array(0);
	#envelopes: Float32Array = new Float32Array(0);
	#line: Path2D = new Path2D();
	#sleeve: Path2D = new Path2D();
	#spots: Path2D = new Path2D();

	constructor(name: string, base: Color, lane: number, direction: number, part: StemMix, gain: number) {
		this.#name = name;
		this.#base = base;
		this.#lane = lane;
		this.#direction = direction;
		this.#part = part;
		this.#gain = gain;
	}

	get name(): string { return this.#name; }
	get share(): number { return this.#share; }
	get color(): Color { return this.#color; }

	get #presence(): number {
		const faint = Thread.#faint;
		const clear = Thread.#clear;
		return Shaper.smoothstep.apply(this.#share.clamp(faint, clear).lerp(faint, clear));
	}

	paint(dark: boolean): void {
		const base = this.#base;
		const { hue, saturation, lightness } = base;

		const color = this.#color = dark ? new Color(base) : Color.fromHSL(hue, saturation * 0.9, 100 - lightness);
		const stroke = this.#stroke = color.toString();
		this.#glow = dark ? stroke : Color.fromHSL(hue, saturation, 15, 0.45).toString();
		this.#shade = new Color(color).pass(dark ? 0.22 : 0.18).toString();
		this.#gradient = null;
	}

	fit(flow: Flow, source: Color, dark: boolean): void {
		const { side, breadth, bend, end } = flow;
		const across = this.#lane * breadth;
		const count = max(32, trunc(end / 3));
		const alongs = this.#alongs = new Float32Array(count);
		const acrosses = this.#acrosses = new Float32Array(count);
		const fractions = this.#fractions = new Float32Array(count);
		const tapers = this.#tapers = new Float32Array(count);
		const smoothstep = Shaper.smoothstep;

		this.#flow = flow;
		this.#origin = source.toString();
		this.#gradient = null;
		this.#width = max(1, side >> 8);
		this.#blur = dark ? side >> 6 : side >> 7;
		this.#dot = max(1.5, side >> 8);
		this.#amplitude = breadth * Thread.#spacing / 2;
		this.#wavelength = side / 20;
		this.#envelopes = new Float32Array(count);
		for (let index = 0; index < count; index++) {
			const along = alongs[index] = index.lerp(0, count - 1) * end;
			const lane = max(0, along - bend);
			acrosses[index] = across * smoothstep.apply(min(1, along / bend));
			fractions[index] = (exp(lane / (end - bend) * 3) - 1) / (exp(3) - 1);
			tapers[index] = smoothstep.apply(min(1, lane / (bend / 4)));
		}
	}

	#follow(spectrum: Float32Array, total: number, delta: number): void {
		const previous = this.#share;
		let sum = 0;
		for (let index = 0; index < spectrum.length; index++) sum += spectrum[index];
		const share = total > 0 ? sum / total : 0;
		const step = Number.isFinite(delta) && delta > 0 ? 1 - exp(-delta / Thread.#lag) : 0;
		this.#share = previous + (share - previous) * step;
	}

	#measure(spectrum: Float32Array): number {
		const fractions = this.#fractions;
		const tapers = this.#tapers;
		const envelopes = this.#envelopes;
		const gain = this.#gain;
		const amplitude = this.#amplitude;
		const shaper = Thread.#shaper;
		const { length } = spectrum;
		const { length: count } = envelopes;

		let sum = 0;
		let weight = 0;
		for (let index = 0; index < count; index++) {
			const level = shaper.apply(min(1, spectrum[trunc(fractions[index] * (length - 1))] * gain));
			const taper = tapers[index];
			envelopes[index] = level * amplitude * taper;
			sum += level * taper;
			weight += taper;
		}
		return weight > 0 ? sum / weight : 0;
	}

	#advance(level: number, volume: number, delta: number): void {
		const intensity = this.#intensity;

		intensity.push(level, volume, delta);
		if (!Number.isFinite(delta) || delta <= 0) return;
		this.#phase += delta * intensity.level.lerp(0, 1, Thread.#calm, Thread.#rush);
	}

	#trace(): void {
		const flow = this.#flow;
		const alongs = this.#alongs;
		const acrosses = this.#acrosses;
		const envelopes = this.#envelopes;
		const direction = this.#direction;
		const amplitude = this.#amplitude;
		const wavelength = this.#wavelength;
		const phase = this.#phase;
		const { length: count } = alongs;
		const wavenumber = 2 * PI / wavelength;
		const shift = direction * 2 * PI * phase;
		const travel = direction * phase * wavelength / alongs[count - 1];

		const line = this.#line = new Path2D();
		for (let index = 0; index < count; index++) {
			const envelope = envelopes[index];
			const along = alongs[index] * direction;
			const across = acrosses[index] + envelope * sin(wavenumber * alongs[index] - shift);
			line.lineTo(flow.x(along, across), flow.y(along, across));
		}

		const sleeve = this.#sleeve = new Path2D();
		for (let index = 0; index < count; index++) {
			const along = alongs[index] * direction;
			const across = acrosses[index] + envelopes[index];
			sleeve.lineTo(flow.x(along, across), flow.y(along, across));
		}
		for (let index = count - 1; index >= 0; index--) {
			const along = alongs[index] * direction;
			const across = acrosses[index] - envelopes[index];
			sleeve.lineTo(flow.x(along, across), flow.y(along, across));
		}
		sleeve.closePath();

		const sparks = Thread.#sparks;
		const dot = this.#dot;
		const spots = this.#spots = new Path2D();
		for (let spark = 0; spark < sparks; spark++) {
			const index = trunc((travel + spark / sparks).mod(1) * (count - 1));
			const envelope = envelopes[index];
			const along = alongs[index] * direction;
			const across = acrosses[index] + envelope * sin(wavenumber * alongs[index] - shift);
			const x = flow.x(along, across);
			const y = flow.y(along, across);
			const radius = dot * (1 + envelope / amplitude);
			spots.moveTo(x + radius, y);
			spots.arc(x, y, radius, 0, 2 * PI);
		}
	}

	update(audioset: Audioset, total: number, delta: number): void {
		const spectrum = this.#part.mix(audioset);
		this.#follow(spectrum, total, delta);
		this.#advance(this.#measure(spectrum), audioset.volume, delta);
		this.#trace();
	}

	#obtainGradient(context: OffscreenCanvasRenderingContext2D): CanvasGradient {
		const shared = this.#gradient;
		if (shared !== null) return shared;
		const flow = this.#flow;
		const along = this.#direction * flow.bend;
		const across = this.#lane * flow.breadth;

		const gradient = this.#gradient = context.createLinearGradient(0, 0, flow.x(along, across), flow.y(along, across));
		gradient.addColorStop(0, this.#origin);
		gradient.addColorStop(1, this.#stroke);
		return gradient;
	}

	draw(host: Host): void {
		const presence = this.#presence;
		const { context } = host;

		context.globalAlpha = presence.lerp(0, 1, Thread.#ghost, 1);
		context.fillStyle = this.#shade;
		context.fill(this.#sleeve);
		context.lineWidth = this.#width;
		context.lineJoin = "round";
		context.strokeStyle = this.#obtainGradient(context);
		context.shadowColor = this.#glow;
		context.shadowBlur = this.#blur;
		context.stroke(this.#line);
		context.fillStyle = this.#stroke;
		context.fill(this.#spots);
	}

	label(context: OffscreenCanvasRenderingContext2D): void {
		const flow = this.#flow;
		const direction = this.#direction;
		const along = direction * (flow.end + flow.side * 0.015);
		const across = this.#lane * flow.breadth;
		const ahead = direction > 0;

		context.textAlign = ahead ? "left" : "right";
		context.textBaseline = "middle";
		if (flow.turned) {
			context.textAlign = "center";
			context.textBaseline = ahead ? "bottom" : "top";
		}
		context.globalAlpha = this.#presence.lerp(0, 1, Thread.#ghost, 1);
		context.fillStyle = this.#stroke;
		context.fillText(this.#name, flow.x(along, across), flow.y(along, across));
	}
}
//#endregion
//#region Threads
Registry.attach("Threads", class extends Visualization {
	#mix: Thread = new Thread("Mix", Color.fromHSL(0, 0, 95), 0, -1, new StemMix(1, 1, 1, 1, 1, 1, 1), 1);
	#stems: Thread[] = [
		new Thread("Vocals", Color.fromHSL(320, 100, 62), -0.30, 1, new StemMix(0, 0, 1, 0, 0, 0, 1), 2),
		new Thread("Guitar", Color.fromHSL(130, 100, 62), -0.18, 1, new StemMix(0, 0, 0, 1, 0, 0, 1), 2),
		new Thread("Keys", Color.fromHSL(190, 100, 62), -0.06, 1, new StemMix(0, 0, 0, 0, 1, 0, 1), 2),
		new Thread("Other", Color.fromHSL(0, 0, 62), 0.06, 1, new StemMix(0, 0, 0, 0, 0, 1, 1), 2),
		new Thread("Drums", Color.fromHSL(35, 100, 62), 0.18, 1, new StemMix(1, 0, 0, 0, 0, 0, 1), 2),
		new Thread("Bass", Color.fromHSL(260, 100, 62), 0.30, 1, new StemMix(0, 1, 0, 0, 0, 0, 1), 2),
	];
	#side: number;
	#haze: number;
	#color: Color | null = null;

	constructor() {
		super();
		const mix = this.#mix;
		this.newLayer("Ambient", this.#drawAmbient.bind(this));
		this.newLayer(mix.name, mix.draw.bind(mix));
		for (const stem of this.#stems) this.newLayer(stem.name, stem.draw.bind(stem));
		this.newLayer("Names", this.#drawNames.bind(this));
	}

	//#region Rebuild
	rebuild(host: Host): void {
		const mix = this.#mix;
		const stems = this.#stems;
		const { context, environment } = host;
		const { width, height } = context.canvas;
		const dark = environment.colorBackground.lightness < 50;
		const flow = new Flow(width, height);

		this.#side = flow.side;
		this.#haze = dark ? 0.25 : 0.12;
		mix.paint(dark);
		for (const stem of stems) stem.paint(dark);
		const source = mix.color;
		mix.fit(flow, source, dark);
		for (const stem of stems) stem.fit(flow, source, dark);
	}
	//#endregion
	//#region Update
	#runThreads(host: Host): void {
		const { audioset, environment } = host;
		const { delta } = environment;
		const { dataFrequency, length } = audioset;

		let total = 0;
		for (let index = 0; index < length; index++) total += dataFrequency[index];
		this.#mix.update(audioset, total, delta);
		for (const stem of this.#stems) stem.update(audioset, total, delta);
	}

	#runAmbient(): void {
		let color: Color | null = null;
		let weight = 0;
		for (const stem of this.#stems) {
			const { share } = stem;
			if (share <= 0) continue;
			weight += share;
			color = color === null ? stem.color : Color.mix(color, stem.color, share / weight);
		}
		if (color === null) return;
		this.#color = color;
	}

	update(host: Host): void {
		if (host.audioset.length === 0) return;
		this.#runThreads(host);
		this.#runAmbient();
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

	#drawNames(host: Host): void {
		const { context } = host;

		context.font = `${trunc(this.#side / 36)}px sans-serif`;
		this.#mix.label(context);
		for (const stem of this.#stems) stem.label(context);
	}
	//#endregion
});
//#endregion
