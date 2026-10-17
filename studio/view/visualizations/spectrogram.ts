"use strict";

import "adaptive-extender/worker";
import { Color, Random, Vector2D } from "adaptive-extender/worker";
import { Blend } from "../../models/blend.js";
import { Registry, Visualization } from "../../services/visualization-registry.js";
import { type Host } from "../../models/visualization.js";
import { AutoRange, HueDrift, Shaper, SpectrumAnalysis, StemMix } from "../../services/visualization-tools.js";

const { min, sign, PI, abs, trunc, exp, meanGeometric } = Math;
const random = Random.global;

//#region Spectrogram
Registry.attach("Spectrogram", class extends Visualization {
	#countStops: number = 64;
	#side: number;
	#lineWidth: number;
	#normPulseEnergy: number = 0;
	#count: number;
	#shaperFrequency: Shaper = Shaper.sigmoid(6, 0.55).then(Shaper.smoothstep);
	#normHeightFactor: number = 0.4;
	#colorRidgeSeed: Color = Color.fromHSL(0, 100, 50);
	#colorRidgeMid: Color = this.#colorRidgeSeed;
	#pathRidge: Path2D = new Path2D();
	#hueSpread: number = 0;
	#hueBias: number = 0;
	#normLightness: number = 0;
	#drift: HueDrift = new HueDrift();
	#deltaRotation: number = 360 / 6;
	#colorShadow: Color = Color.newBlack;
	#silhouette: StemMix = new StemMix(0.5, 1, 1, 1, 1, 1, 1.03); // drums at half weight, the gain lets the ridge's peaks reach the mix's height
	#instruments: StemMix = new StemMix(0, 0, 0, 1, 1, 1, 1); // guitar + keys + other: everything but drums, bass and vocals, the "other" these levels were tuned on
	#drums: SpectrumAnalysis = new SpectrumAnalysis();
	#bass: SpectrumAnalysis = new SpectrumAnalysis();
	#vocals: SpectrumAnalysis = new SpectrumAnalysis();
	#other: SpectrumAnalysis = new SpectrumAnalysis();
	#drop: AutoRange = new AutoRange(0.0455, 0.9471);
	#percussiveness: AutoRange = new AutoRange(0.0259, 1);
	#bassLevel: AutoRange = new AutoRange(0.0240, 0.7524);
	#subBass: AutoRange = new AutoRange(0.0285, 0.8544);
	#centroid: AutoRange = new AutoRange(0.0930, 0.3115);
	#high: AutoRange = new AutoRange(0.0006, 0.2653);
	#highMid: AutoRange = new AutoRange(0.0071, 0.3011);
	#flux: AutoRange = new AutoRange(0.0010, 0.0202);
	#volume: AutoRange = new AutoRange(0.0355, 0.1996);

	constructor() {
		super();
		this.newLayer("Ridge", this.#drawRidge.bind(this));
		this.newLayer("Bloom", this.#drawBloom.bind(this), { blend: Blend.lighter });
		this.newLayer("Thread", this.#drawThread.bind(this), { blend: Blend.lighter });
		this.newLayer("Vignette", this.#drawVignette.bind(this), { blend: Blend.multiply });
	}

	//#region Rebuild
	rebuild(host: Host): void {
		const { context, audioset } = host;
		const { width, height } = context.canvas;
		const { length } = audioset;

		const side = this.#side = min(width, height);
		this.#lineWidth = side >> 8;
		this.#count = trunc(min(width, length));
	}
	//#endregion
	//#region Update
	#runLevels(host: Host): void {
		const { audioset, environment } = host;
		const { delta } = environment;
		const { volume, subBass } = audioset;
		const drums = this.#drums;
		const bass = this.#bass;
		const vocals = this.#vocals;
		const other = this.#other;

		drums.analyze(audioset.dataDrums, audioset);
		bass.analyze(audioset.dataBass, audioset);
		vocals.analyze(audioset.dataVocals, audioset);
		other.analyze(this.#instruments.mix(audioset), audioset);
		const energy = vocals.energy + other.energy;
		let centroid = 0;
		if (energy > 0) centroid = (vocals.spectralCentroid * vocals.energy + other.spectralCentroid * other.energy) / energy;
		this.#drop.push(min(1, drums.percussiveness * 3) * subBass, volume, delta);
		this.#percussiveness.push(drums.percussiveness, volume, delta);
		this.#bassLevel.push(bass.bassLevel, volume, delta);
		this.#subBass.push(bass.subBass, volume, delta);
		this.#centroid.push(centroid, volume, delta);
		this.#high.push(drums.high, volume, delta);
		this.#highMid.push(drums.highMid, volume, delta);
		this.#flux.push(vocals.spectralFlux + other.spectralFlux, volume, delta);
		this.#volume.push(volume, volume, delta);
	}

	#runRidgeRotation(host: Host): void {
		const { audioset, environment } = host;
		const { delta } = environment;

		this.#drift.tick(this.#colorRidgeSeed, this.#deltaRotation, delta, audioset.volume);
	}

	#runCameraUpdate(host: Host): void {
		const side = this.#side;
		const { context, audioset, environment } = host;
		const { delta } = environment;
		const { beatDetected } = audioset;

		this.#normPulseEnergy = (this.#normPulseEnergy - delta * 0.004).clamp(0, Infinity);
		if (beatDetected) this.#normPulseEnergy = 1;

		const pulse = 1 + this.#normPulseEnergy * this.#percussiveness.level.lerp(0, 1, 0.03, 0.08);
		const shake = this.#drop.level.lerp(0, 1, 0, side >> 7);
		context.translate(random.number(-1, 1) * shake, random.number(-1, 1) * shake);
		context.scale(pulse, pulse);
	}

	#runRidgeBuilding(host: Host): void {
		const count = this.#count;
		const shaper = this.#shaperFrequency;
		const peak = this.#side * this.#normHeightFactor;
		const colorRidgeSeed = this.#colorRidgeSeed;
		const { context, audioset } = host;
		const { width } = context.canvas;
		const { volume, spectralCentroid, length } = audioset; // brightness stays on production's own scale
		const dataFrequency = this.#silhouette.mix(audioset);
		const loudness = this.#volume.level;
		const focusBin = (length - 1) / 2;
		const hueSpread = this.#hueSpread = 120;
		const hueBias = this.#hueBias = this.#centroid.level.lerp(0, 1, -40, 40);
		const normLightness = this.#normLightness = meanGeometric(volume.lerp(0, 1, 0.25, 0.75), spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, 0.3, 0.8));
		const envelope = meanGeometric(loudness.lerp(0, 1, 0.7, 1.3), loudness.lerp(0, 1, 0.8, 1.2));
		this.#colorRidgeMid = new Color(colorRidgeSeed).rotate(hueSpread * 0.5 + hueBias).illuminate(normLightness);

		const path = this.#pathRidge = new Path2D();
		const position = Vector2D.newNaN;
		for (let index = 1 - count; index < count; index++) {
			const direction = sign(index).insteadZero(-1);
			const normProgress = index.lerp(0, direction * (count - 1));
			const normEdge = abs(normProgress - 0.5) * 2;
			const dataIndex = trunc((exp(normEdge * 3) - 1) / (exp(3) - 1) * (length - 1));
			const focusWeight = 1 - abs(dataIndex - focusBin).lerp(0, length, 0, 1) * 0.3;
			const magnitude = (dataFrequency[dataIndex] * normEdge.lerp(0, 1, 1.0, 2.4)).lerp(0, 1.8);
			const normScale = shaper.apply(magnitude) * envelope * focusWeight;
			position.x = width * (normProgress - 0.5);
			position.y = direction * normScale * peak;
			path.lineTo(position.x, position.y);
		}
		path.closePath();
	}

	update(host: Host): void {
		this.#runLevels(host);
		this.#runRidgeRotation(host);
		this.#runCameraUpdate(host);
		this.#runRidgeBuilding(host);
	}
	//#endregion
	//#region Layers
	#drawRidge(host: Host): void {
		const lineWidth = this.#lineWidth;
		const countStops = this.#countStops;
		const hueSpread = this.#hueSpread;
		const hueBias = this.#hueBias;
		const normLightness = this.#normLightness;
		const colorRidgeSeed = this.#colorRidgeSeed;
		const pathRidge = this.#pathRidge;
		const { context } = host;
		const { width } = context.canvas;

		const gradientRidge = context.createLinearGradient(-width / 2, 0, width / 2, 0);
		for (let index = 0; index <= countStops; index++) {
			const normProgress = index.lerp(0, countStops);
			gradientRidge.addColorStop(normProgress, new Color(colorRidgeSeed)
				.rotate(hueSpread * normProgress + hueBias)
				.illuminate(normLightness)
				.toString());
		}
		context.fillStyle = gradientRidge;
		const blurRidge = trunc(this.#bassLevel.level.lerp(0, 1, lineWidth * 2, lineWidth * 10) / 2);
		if (blurRidge >= 1) {
			context.filter = `blur(${blurRidge}px)`;
			context.fill(pathRidge);
			context.filter = "none";
		}
		context.fill(pathRidge);
	}

	#drawBloom(host: Host): void {
		const colorRidgeMid = this.#colorRidgeMid;
		const { context, audioset } = host;
		const { bass } = audioset;
		const bloomEnergy = meanGeometric(this.#subBass.level, bass.clamp(0, 0.8).lerp(0, 0.8, 0, 1));
		const radius = this.#side * bloomEnergy.lerp(0, 1, 0.05, 0.22);

		const gradientBloom = context.createRadialGradient(0, 0, 0, 0, 0, radius);
		gradientBloom.addColorStop(0, new Color(colorRidgeMid).pass(this.#bassLevel.level.lerp(0, 1, 0.15, 0.45)).toString());
		gradientBloom.addColorStop(1, new Color(colorRidgeMid).pass(0).toString());
		context.fillStyle = gradientBloom;
		context.beginPath();
		context.arc(0, 0, radius, 0, 2 * PI);
		context.fill();
	}

	#drawThread(host: Host): void {
		const count = this.#count;
		const lineWidth = this.#lineWidth;
		const colorRidgeMid = this.#colorRidgeMid;
		const { context, audioset } = host;
		const { dataTemporal, volume, length } = audioset;
		const { width } = context.canvas;
		const peak = this.#side * this.#normHeightFactor;
		const sparkle = meanGeometric(this.#high.level, this.#highMid.level);
		const shimmer = this.#flux.level.lerp(0, 1, 0.5, 1);

		context.beginPath();
		const position = Vector2D.newNaN;
		for (let index = 0; index < count; index++) {
			const normProgress = index.lerp(0, count - 1);
			const dataIndex = trunc(normProgress.lerp(0, 1, 0, length - 1));
			const normDatumTemporal = dataTemporal[dataIndex].lerp(0, 1, -1, 1);
			position.x = width * (normProgress - 0.5);
			position.y = normDatumTemporal * volume * peak * 0.6;
			if (index === 0) context.moveTo(position.x, position.y);
			else context.lineTo(position.x, position.y);
		}
		context.strokeStyle = new Color(colorRidgeMid).pass(shimmer.lerp(0, 1, 0.5, 0.9)).toString();
		context.lineWidth = lineWidth * 0.5;
		context.shadowColor = colorRidgeMid.toString();
		context.shadowBlur = sparkle.lerp(0, 1, 0, lineWidth * 6);
		context.stroke();
	}

	#drawVignette(host: Host): void {
		const colorShadow = this.#colorShadow;
		const { context } = host;
		const { width, height } = context.canvas;

		context.resetTransform();
		const gradientVignette = context.createLinearGradient(0, 0, 0, height);
		gradientVignette.addColorStop(0, colorShadow.pass(0.45).toString());
		gradientVignette.addColorStop(0.5, colorShadow.pass(0).toString());
		gradientVignette.addColorStop(1, colorShadow.pass(0.45).toString());
		context.fillStyle = gradientVignette;
		context.fillRect(0, 0, width, height);
	}
	//#endregion
});
//#endregion
