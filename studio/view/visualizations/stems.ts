"use strict";

import "adaptive-extender/worker";
import { Color } from "adaptive-extender/worker";
import { Registry, Visualization } from "../../services/visualization-registry.js";
import { type Audioset, type Host } from "../../models/visualization.js";
import { Belt, Shaper, Smoother, SpectrumAnalysis, StemMix, WaveformAnalysis } from "../../services/visualization-tools.js";

const { min, max, sin, trunc, PI } = Math;

//#region Flow
class Flow {
	static #bend: number = 0.1;
	static #depth: number = 0.425;
	static #floor: number = 0.34;
	static #room: number = 0.07;

	#turned: boolean;
	#half: number;
	#breadth: number;
	#side: number;
	#end: number;
	#shift: number;
	#legend: number;

	constructor(width: number, height: number) {
		const turned = this.#turned = height > width;
		const side = this.#side = min(width, height);
		const half = this.#half = (turned ? height : width) / 2;
		this.#breadth = turned ? width : height;
		const legend = this.#legend = turned ? height / 2 - side * Flow.#floor : side * Flow.#depth;
		const head = half - side * (turned ? 0.2 : 0.14);
		const tail = turned ? legend - side * Flow.#room : head;
		this.#end = (head + tail) / 2;
		this.#shift = (tail - head) / 2;
	}

	get turned(): boolean { return this.#turned; }
	get side(): number { return this.#side; }
	get breadth(): number { return this.#breadth; }
	get bend(): number { return this.#half * Flow.#bend; }
	get end(): number { return this.#end; }
	get legend(): number { return this.#legend; }

	x(along: number, across: number): number {
		return this.#turned ? across : along;
	}

	y(along: number, across: number): number {
		return this.#turned ? this.#shift - along : across;
	}

	lineTo(path: Path2D, along: number, across: number): void {
		path.lineTo(this.x(along, across), this.y(along, across));
	}
}
//#endregion
//#region Thread
class Thread {
	static #spacing: number = 0.12;
	static #split: number = 0.2;
	static #sparks: number = 5;
	static #lag: number = 0.15;
	static #ghost: number = 0.85;
	static #pulsing: number = 1;
	static #swelling: number = 0.5;
	static #thickening: number = 1.5;
	static #glare: number = 5;
	static #bloom: number = 0.35;
	static #shaper: Shaper = Shaper.sigmoid().then(Shaper.arcsinSaturate);
	static #presence: Shaper = Shaper.smoothstep.between(0.1, 0.35);
	static #bins: Shaper = Shaper.exponential(3);

	#name: string;
	#base: Color;
	#lane: number;
	#direction: number;
	#part: StemMix;
	#gain: number;
	#warmth: Shaper;
	#share: Smoother = new Smoother(Thread.#lag);
	#heat: Smoother = new Smoother(Thread.#lag);
	#analysis: SpectrumAnalysis = new SpectrumAnalysis();
	#belt: Belt;
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
	#level: number = 0;
	#amplitude: number;
	#alongs: Float32Array = new Float32Array(0);
	#acrosses: Float32Array = new Float32Array(0);
	#fractions: Float32Array = new Float32Array(0);
	#tapers: Float32Array = new Float32Array(0);
	#envelopes: Float32Array = new Float32Array(0);
	#distances: Float32Array = new Float32Array(0);
	#line: Path2D = new Path2D();
	#sleeve: Path2D = new Path2D();
	#spots: Path2D = new Path2D();

	constructor(name: string, base: Color, lane: number, direction: number, part: StemMix, gain: number, calm: number, loud: number) {
		this.#name = name;
		this.#base = base;
		this.#lane = lane;
		this.#direction = direction;
		this.#part = part;
		this.#gain = gain;
		this.#warmth = Shaper.smoothstep.between(calm, loud);
	}

	get name(): string { return this.#name; }
	get share(): number { return this.#share.value; }
	get heat(): number { return this.#heat.value; }
	get rise(): number { return this.#analysis.spectralFlux; }
	get color(): Color { return this.#color; }

	get #alpha(): number {
		return Thread.#presence.apply(this.#share.value).lerp(0, 1, Thread.#ghost, 1);
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
		const split = Thread.#split;
		const direction = this.#direction;
		const plain = direction < 0 ? bend * split / (1 - split) : bend;
		const across = this.#lane * breadth;
		const count = max(32, trunc(end / 3));
		const alongs = this.#alongs = new Float32Array(count);
		const acrosses = this.#acrosses = new Float32Array(count);
		const fractions = this.#fractions = new Float32Array(count);
		const tapers = this.#tapers = new Float32Array(count);
		const distances = this.#distances = new Float32Array(count);
		const smoothstep = Shaper.smoothstep;
		const bins = Thread.#bins;

		this.#flow = flow;
		this.#belt = new Belt(2 * end, 0, 0);
		this.#origin = source.toString();
		this.#gradient = null;
		this.#width = max(1, side >> 8);
		this.#blur = dark ? side >> 6 : side >> 7;
		this.#dot = max(1.5, side >> 8);
		this.#amplitude = breadth * Thread.#spacing / 2;
		this.#envelopes = new Float32Array(count);
		for (let index = 0; index < count; index++) {
			const along = alongs[index] = index.lerp(0, count - 1) * end;
			const lane = max(0, along - plain);
			acrosses[index] = across * smoothstep.apply(min(1, along / bend));
			fractions[index] = bins.apply(lane / (end - plain));
			tapers[index] = smoothstep.apply(min(1, lane / (plain / 4)));
			distances[index] = end + direction * along;
		}
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

	listen(pulse: number, distance: number, level: number): void {
		const belt = this.#belt;
		const distances = this.#distances;
		const envelopes = this.#envelopes;
		const pulsing = Thread.#pulsing;
		const swell = 1 + Thread.#swelling * level;

		this.#level = level;
		belt.advance(distance, pulse);
		for (let index = 0; index < envelopes.length; index++) envelopes[index] *= swell + pulsing * belt.at(distances[index]);
	}

	trace(belt: Belt, travel: number): void {
		const flow = this.#flow;
		const alongs = this.#alongs;
		const acrosses = this.#acrosses;
		const envelopes = this.#envelopes;
		const distances = this.#distances;
		const direction = this.#direction;
		const amplitude = this.#amplitude;
		const { length: count } = alongs;
		const offset = direction * travel / alongs[count - 1];

		const line = this.#line = new Path2D();
		for (let index = 0; index < count; index++) flow.lineTo(line, alongs[index] * direction, acrosses[index] + envelopes[index] * sin(2 * PI * belt.at(distances[index])));

		const sleeve = this.#sleeve = new Path2D();
		for (let index = 0; index < count; index++) flow.lineTo(sleeve, alongs[index] * direction, acrosses[index] + envelopes[index]);
		for (let index = count - 1; index >= 0; index--) flow.lineTo(sleeve, alongs[index] * direction, acrosses[index] - envelopes[index]);
		sleeve.closePath();

		const sparks = Thread.#sparks;
		const dot = this.#dot;
		const spots = this.#spots = new Path2D();
		for (let spark = 0; spark < sparks; spark++) {
			const index = trunc((offset + spark / sparks).mod(1) * (count - 1));
			const envelope = envelopes[index];
			const along = alongs[index] * direction;
			const across = acrosses[index] + envelope * sin(2 * PI * belt.at(distances[index]));
			const x = flow.x(along, across);
			const y = flow.y(along, across);
			const radius = dot * (1 + envelope / amplitude);
			spots.moveTo(x + radius, y);
			spots.arc(x, y, radius, 0, 2 * PI);
		}
	}

	update(audioset: Audioset, total: number, delta: number): void {
		const spectrum = this.#part.mix(audioset);
		let sum = 0;
		for (let index = 0; index < spectrum.length; index++) sum += spectrum[index];
		this.#share.push(total > 0 ? sum / total : 0, delta);
		this.#heat.push(this.#warmth.apply(this.#measure(spectrum)), delta);
		this.#analysis.analyze(spectrum, audioset);
	}

	#obtainGradient(context: OffscreenCanvasRenderingContext2D): CanvasGradient {
		const shared = this.#gradient;
		if (shared !== null) return shared;
		const flow = this.#flow;
		const along = this.#direction * flow.bend;
		const across = this.#lane * flow.breadth;

		const gradient = this.#gradient = context.createLinearGradient(flow.x(0, 0), flow.y(0, 0), flow.x(along, across), flow.y(along, across));
		gradient.addColorStop(0, this.#origin);
		gradient.addColorStop(1, this.#stroke);
		return gradient;
	}

	draw(host: Host): void {
		const alpha = this.#alpha;
		const line = this.#line;
		const width = this.#width * (1 + Thread.#thickening * this.#level);
		const { context } = host;
		const halo = alpha * this.#heat.value * Thread.#bloom;

		context.globalAlpha = alpha;
		context.fillStyle = this.#shade;
		context.fill(this.#sleeve);
		context.lineJoin = "round";
		context.strokeStyle = this.#obtainGradient(context);
		context.shadowColor = this.#glow;
		context.shadowBlur = this.#blur;
		if (halo * 255 >= 1) {
			context.globalAlpha = halo;
			context.lineWidth = width * Thread.#glare;
			context.stroke(line);
			context.globalAlpha = alpha;
		}
		context.lineWidth = width;
		context.stroke(line);
		context.fillStyle = this.#stroke;
		context.fill(this.#spots);
	}

	#ink(context: OffscreenCanvasRenderingContext2D): void {
		context.globalAlpha = this.#alpha;
		context.fillStyle = this.#stroke;
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
		this.#ink(context);
		context.fillText(this.#name, flow.x(along, across), flow.y(along, across));
	}

	mark(context: OffscreenCanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
		this.#ink(context);
		context.fillRect(x, y, width, height);
	}

	caption(context: OffscreenCanvasRenderingContext2D, x: number, y: number): void {
		this.#ink(context);
		context.fillText(this.#name, x, y);
	}
}
//#endregion
//#region Stems
Registry.attach("Stems", class Stems extends Visualization {
	static #calm: number = 1;
	static #rush: number = 40;
	static #stride: number = 0.45;
	static #stretch: number = 8;
	static #typical: number = 0.274;
	static #swell: Shaper = Shaper.smoothstep.between(0.6, 1);

	#mix: Thread = new Thread("Mix", Color.fromHSL(0, 0, 95), 0, -1, new StemMix(1, 1, 1, 1, 1, 1, 1), 1, 0.499, 0.776);
	#backing: Thread = new Thread("Backing", Color.fromHSL(0, 0, 50), 0, 1, new StemMix(1, 1, 0, 1, 1, 1, 1), 1, 0.241, 0.744);
	#stems: Thread[] = [
		new Thread("Vocals", Color.fromHSL(320, 100, 62), -0.30, 1, new StemMix(0, 0, 1, 0, 0, 0, 1), 2, 0.072, 0.557),
		new Thread("Guitar", Color.fromHSL(130, 100, 62), -0.18, 1, new StemMix(0, 0, 0, 1, 0, 0, 1), 2, 0.200, 0.565),
		new Thread("Keys", Color.fromHSL(190, 100, 62), -0.06, 1, new StemMix(0, 0, 0, 0, 1, 0, 1), 2, 0.121, 0.292),
		new Thread("Other", Color.fromHSL(0, 0, 62), 0.06, 1, new StemMix(0, 0, 0, 0, 0, 1, 1), 2, 0.039, 0.183),
		new Thread("Drums", Color.fromHSL(35, 100, 62), 0.18, 1, new StemMix(1, 0, 0, 0, 0, 0, 1), 2, 0.221, 0.608),
		new Thread("Bass", Color.fromHSL(260, 100, 62), 0.30, 1, new StemMix(0, 1, 0, 0, 0, 0, 1), 2, 0.073, 0.111),
	];
	#loudness: Smoother = new Smoother(1);
	#peak: Smoother = new Smoother(60, Stems.#typical);
	#waveform: WaveformAnalysis = new WaveformAnalysis();
	#tempo: number = 0;
	#phase: number = 0;
	#travel: number = 0;
	#flow: Flow;
	#belt: Belt;
	#haze: number;
	#balance: Float32Array = new Float32Array(this.#stems.length).fill(1);

	constructor() {
		super();
		const mix = this.#mix;
		this.newLayer("Ambient", this.#drawAmbient.bind(this));
		this.newLayer(mix.name, mix.draw.bind(mix));
		for (const stem of this.#stems) this.newLayer(stem.name, stem.draw.bind(stem));
		this.newLayer("Names", this.#drawNames.bind(this));
		this.newLayer("Legend", this.#drawLegend.bind(this));
	}

	get #wavelength(): number {
		return this.#flow.side / 20 * (1 + (Stems.#stretch - 1) * this.#tempo);
	}

	//#region Rebuild
	rebuild(host: Host): void {
		const mix = this.#mix;
		const stems = this.#stems;
		const { context, environment } = host;
		const { width, height } = context.canvas;
		const dark = environment.colorBackground.lightness < 50;
		const flow = this.#flow = new Flow(width, height);

		this.#belt = new Belt(2 * flow.end, this.#phase, 1 / this.#wavelength);
		this.#haze = dark ? 0.25 : 0.12;
		mix.paint(dark);
		for (const stem of stems) stem.paint(dark);
		const source = mix.color;
		mix.fit(flow, source, dark);
		for (const stem of stems) stem.fit(flow, source, dark);
		this.#backing.fit(flow, source, dark);
	}
	//#endregion
	//#region Update
	#runThreads(host: Host): number {
		const { audioset, environment } = host;
		const { delta } = environment;
		const { dataFrequency, length } = audioset;

		let total = 0;
		for (let index = 0; index < length; index++) total += dataFrequency[index];
		this.#mix.update(audioset, total, delta);
		for (const stem of this.#stems) stem.update(audioset, total, delta);
		this.#backing.update(audioset, total, delta);
		return total;
	}

	#runPulse(host: Host, distance: number): void {
		const stems = this.#stems;
		const waveform = this.#waveform;

		waveform.analyze(host.audioset);
		const { hit, level } = waveform;
		this.#mix.listen(hit, distance, level);
		let sum = 0;
		for (const stem of stems) sum += stem.rise;
		for (const stem of stems) stem.listen(sum > 0 ? hit * stem.rise / sum : 0, distance, level);
	}

	#runPace(host: Host): number {
		const loudness = this.#loudness;
		const peak = this.#peak;
		const { audioset, environment } = host;
		const { volume } = audioset;
		const { delta } = environment;

		if (!Number.isFinite(delta) || delta <= 0) return 0;
		const level = this.#backing.heat;
		loudness.push(volume, delta);
		peak.push(Stems.#typical, delta);
		peak.raise(loudness.value);
		this.#tempo = Stems.#swell.apply(loudness.value / peak.value);
		const step = min(Stems.#stride, delta * level.lerp(0, 1, Stems.#calm, Stems.#rush));
		const distance = step * this.#wavelength;
		const phase = this.#phase += step;
		this.#travel += distance;
		this.#belt.advance(distance, phase);
		return distance;
	}

	#runTraces(): void {
		const belt = this.#belt;
		const travel = this.#travel;

		this.#mix.trace(belt, travel);
		for (const stem of this.#stems) stem.trace(belt, travel);
	}

	get #ambient(): Color {
		const stems = this.#stems;
		const balance = this.#balance;
		let color = stems[0].color;
		let weight = 0;
		for (let index = 0; index < stems.length; index++) {
			const share = balance[index];
			if (share <= 0) continue;
			weight += share;
			color = Color.mix(color, stems[index].color, share / weight);
		}
		return color;
	}

	#runAmbient(total: number): void {
		const stems = this.#stems;
		const balance = this.#balance;
		if (total <= 0) return;
		let weight = 0;
		for (const stem of stems) weight += stem.share;
		if (weight <= 0) return;
		for (let index = 0; index < stems.length; index++) balance[index] = stems[index].share;
	}

	update(host: Host): void {
		if (host.audioset.length === 0) return;
		const total = this.#runThreads(host);
		const distance = this.#runPace(host);
		this.#runPulse(host, distance);
		this.#runTraces();
		this.#runAmbient(total);
	}
	//#endregion
	//#region Layers
	#drawAmbient(host: Host): void {
		const color = this.#ambient;
		const { context } = host;
		const { width, height } = context.canvas;

		const gradient = context.createRadialGradient(0, 0, 0, 0, 0, max(width, height) * 0.75);
		gradient.addColorStop(0, new Color(color).pass(this.#haze).toString());
		gradient.addColorStop(1, new Color(color).pass(0).toString());
		context.fillStyle = gradient;
		context.fillRect(-width, -height, width * 2, height * 2);
	}

	#drawNames(host: Host): void {
		const { context } = host;

		context.font = `${trunc(this.#flow.side / 36)}px sans-serif`;
		this.#mix.label(context);
		for (const stem of this.#stems) stem.label(context);
	}

	#drawLegend(host: Host): void {
		const stems = this.#stems;
		const { side, legend } = this.#flow;
		const { context } = host;
		const { width, height } = context.canvas;
		const span = side * 0.9;
		const left = (width - span) / 2;
		const middle = height / 2;
		const top = middle + legend;
		const thickness = max(2, side >> 7);
		const slot = span / stems.length;

		context.resetTransform();
		context.font = `${trunc(side / 36)}px sans-serif`;
		context.textAlign = "center";
		let x = left;
		for (let index = 0; index < stems.length; index++) {
			const stem = stems[index];
			const segment = stem.share * span;
			stem.mark(context, x, top, segment, thickness);
			stem.caption(context, left + slot * (index + 0.5), top + side * 0.045);
			x += segment;
		}
	}
	//#endregion
});
//#endregion
