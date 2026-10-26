"use strict";

import "adaptive-extender/worker";
import { Color, Random } from "adaptive-extender/worker";
import { Registry, Visualization } from "../../services/visualization-registry.js";
import { type Host } from "../../models/visualization.js";
import { AutoRange, HueDrift, Shaper, SpectrumAnalysis, StemMix } from "../../services/visualization-tools.js";

const { min, sin, cos, PI, abs, trunc, SQRT1_2, meanGeometric } = Math;
const random = Random.global;

//#region Pulsar
Registry.attach("Pulsar", class Pulsar extends Visualization {
	static #countStops: number = 96;
	static #shaperFrequency: Shaper = Shaper.sigmoid().then(Shaper.arcsinSaturate);

	#radius: number;
	#stopsHalo: string[] = [];
	#gradientHalo: CanvasGradient | null = null;
	#pathHalo: Path2D = new Path2D();
	#pathWave: Path2D = new Path2D();
	#drift: HueDrift = new HueDrift(Color.fromHSL(0, 100, 60), 360 / 6);
	#colorShadow: Color;
	#silhouette: StemMix = new StemMix(0.5, 1, 1, 1, 1, 1, 1.03); // drums at half weight, the gain lets the ring's peaks reach the mix's height
	#instruments: StemMix = new StemMix(0, 0, 0, 1, 1, 1, 1); // guitar + keys + other: everything but drums, bass and vocals, the "other" these levels were tuned on
	#drums: SpectrumAnalysis = new SpectrumAnalysis();
	#bass: SpectrumAnalysis = new SpectrumAnalysis();
	#vocals: SpectrumAnalysis = new SpectrumAnalysis();
	#other: SpectrumAnalysis = new SpectrumAnalysis();
	#drop: AutoRange = new AutoRange(0.0455, 0.9471);
	#percussiveness: AutoRange = new AutoRange(0.0259, 1);
	#bassLevel: AutoRange = new AutoRange(0.0240, 0.7524);
	#centroid: AutoRange = new AutoRange(0.0930, 0.3115);

	constructor() {
		super();
		this.newLayer("Halo", this.#drawHalo.bind(this));
		this.newLayer("Wave", this.#drawWave.bind(this));
		this.newLayer("Shadow", this.#drawShadow.bind(this));
	}

	//#region Rebuild
	rebuild(host: Host): void {
		const { context, environment } = host;
		const { width, height } = context.canvas;
		const { hue, saturation, lightness } = environment.colorBackground;

		this.#radius = min(width, height) / 2;
		this.#colorShadow = Color.fromHSL(hue, saturation, lightness.snap(100));
	}
	//#endregion
	//#region Update
	#runLevels(host: Host): void {
		const { audioset } = host;
		const { subBass } = audioset;
		const drums = this.#drums;
		const bass = this.#bass;
		const vocals = this.#vocals;
		const other = this.#other;

		drums.analyze(audioset.dataDrums, audioset);
		bass.analyze(audioset.dataBass, audioset);
		vocals.analyze(audioset.dataVocals, audioset);
		other.analyze(this.#instruments.mix(audioset), audioset);
		this.#drop.push(min(1, drums.percussiveness * 3) * subBass, host);
		this.#percussiveness.push(drums.percussiveness, host);
		this.#bassLevel.push(bass.bassLevel, host);
		this.#centroid.push(SpectrumAnalysis.centroid(vocals, other), host);
	}

	#runCameraUpdate(host: Host): void {
		const radius = this.#radius;

		const shake = this.#drop.level.lerp(0, 1, 0, radius >> 6);
		host.context.translate(random.number(-1, 1) * shake, random.number(-1, 1) * shake);
	}

	#runHaloRotation(host: Host): void {
		const { audioset, environment } = host;

		this.#drift.tick(environment.delta, audioset.volume);
	}

	#runHaloBuilding(host: Host): void {
		const radius = this.#radius;
		const countStops = Pulsar.#countStops;
		const colorHaloOuter = this.#drift.color;
		const shaperFrequency = Pulsar.#shaperFrequency;
		const stops = this.#stopsHalo;
		const { audioset } = host;
		const { volume, bassLevel, length } = audioset; // brightness stays on production's own scale
		const dataFrequency = this.#silhouette.mix(audioset);
		const semiLength = length / 2;
		const hueBias = this.#centroid.level.lerp(0, 1, -30, 30);
		const normIllumination = meanGeometric(volume.lerp(0, 1, 0.1, 1.0), bassLevel.clamp(0, 0.6).lerp(0, 0.6, 0.5, 1.0));

		this.#gradientHalo = null;
		stops.length = 0;
		for (let index = 0; index < countStops; index++) {
			const normEdge = abs(index.lerp(0, countStops) - 0.5) * 2;
			stops.push(new Color(colorHaloOuter)
				.rotate(180 * normEdge + hueBias)
				.illuminate(normIllumination)
				.toString());
		}

		const path = this.#pathHalo = new Path2D();
		for (let index = 0; index < length; index++) {
			const normProgress = index.lerp(0, length);
			const normOffset = abs(index - semiLength).lerp(0, semiLength + 1);
			const normScale = shaperFrequency.apply(dataFrequency[trunc(normOffset * semiLength)]);
			const distance = normScale.lerp(0, 1, 0.6, 1.0) * radius;
			path.lineTo(distance * sin(normProgress * 2 * PI), distance * cos(normProgress * 2 * PI));
		}
		path.closePath();
	}

	#runWaveBuilding(host: Host): void {
		const radius = this.#radius;
		const { context, audioset } = host;
		const { width } = context.canvas;
		const { dataTemporal, volume, length } = audioset;
		const scalePercussive = this.#percussiveness.level.lerp(0, 1, 1.0, 1.15);

		const path = this.#pathWave = new Path2D();
		path.moveTo(-width / 2, 0);
		for (let index = 0; index < length; index++) {
			const normProgress = index.lerp(0, length);
			const normDatumTemporal = dataTemporal[trunc(normProgress * length)].lerp(0, 1, -1, 1);
			const normScale = normDatumTemporal * volume * scalePercussive;
			path.lineTo(width * (normProgress - 0.5), radius * normScale);
		}
		path.lineTo(width / 2, 0);
	}

	update(host: Host): void {
		this.#runLevels(host);
		this.#runHaloRotation(host);
		this.#runCameraUpdate(host);
		this.#runHaloBuilding(host);
		this.#runWaveBuilding(host);
	}
	//#endregion
	//#region Layers
	#obtainGradientHalo(context: OffscreenCanvasRenderingContext2D): CanvasGradient {
		const shared = this.#gradientHalo;
		if (shared !== null) return shared;
		const stops = this.#stopsHalo;
		const { length } = stops;

		const gradientHalo = this.#gradientHalo = context.createConicGradient(PI / 2, 0, 0);
		for (let index = 0; index < length; index++) gradientHalo.addColorStop(index.lerp(0, length), stops[index]);
		gradientHalo.addColorStop(1, stops[0]);
		return gradientHalo;
	}

	#drawHalo(host: Host): void {
		const radius = this.#radius;
		const colorShadow = this.#colorShadow;
		const pathHalo = this.#pathHalo;
		const { context } = host;

		context.lineWidth = radius >> 7;
		context.fillStyle = colorShadow.toString();
		context.fill(pathHalo);
		context.strokeStyle = this.#obtainGradientHalo(context);
		const blurHalo = trunc(this.#bassLevel.level.lerp(0, 1, radius >> 6, radius >> 3) / 2);
		if (blurHalo >= 1) {
			context.filter = `blur(${blurHalo}px)`;
			context.stroke(pathHalo);
			context.filter = "none";
		}
		context.stroke(pathHalo);
	}

	#drawWave(host: Host): void {
		const radius = this.#radius;
		const pathWave = this.#pathWave;
		const { context } = host;

		context.lineWidth = radius >> 7;
		context.clip(this.#pathHalo);
		const gradientHalo = this.#obtainGradientHalo(context);
		context.fillStyle = gradientHalo;
		context.fill(pathWave);
		context.strokeStyle = gradientHalo;
		context.stroke(pathWave);
	}

	#drawShadow(host: Host): void {
		const radius = this.#radius;
		const colorShadow = this.#colorShadow;
		const { context } = host;

		const gradientShadow = context.createRadialGradient(0, 0, 0, 0, 0, radius);
		gradientShadow.addColorStop(0, new Color(colorShadow).pass(1).toString());
		gradientShadow.addColorStop(0.5, new Color(colorShadow).pass(SQRT1_2).toString());
		gradientShadow.addColorStop(1, new Color(colorShadow).pass(0).toString());
		context.fillStyle = gradientShadow;
		context.fill(this.#pathWave);
	}
	//#endregion
});
//#endregion
