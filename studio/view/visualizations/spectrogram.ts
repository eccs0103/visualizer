"use strict";

import "adaptive-extender/worker";
import { Color, Random } from "adaptive-extender/worker";
import { Blend } from "../../models/blend.js";
import { Registry, Visualization } from "../../services/visualization-registry.js";
import { type Host } from "../../models/visualization.js";
import { AutoRange, HueDrift, Shaper, SpectrumAnalysis, StemMix } from "../../services/visualization-tools.js";

const { min, sign, PI, abs, trunc, meanGeometric } = Math;
const random = Random.global;

//#region Spectrogram
Registry.attach("Spectrogram", class Spectrogram extends Visualization {
	static #countStops: number = 64;
	static #normHeightFactor: number = 0.4;
	static #hueSpread: number = 120;
	static #colorShadow: Color = Color.newBlack;
	static #shaperFrequency: Shaper = Shaper.sigmoid(6, 0.55).then(Shaper.smoothstep);
	static #bins: Shaper = Shaper.exponential(3);

	#side: number;
	#lineWidth: number;
	#normPulseEnergy: number = 0;
	#count: number;
	#drift: HueDrift = new HueDrift(Color.fromHSL(0, 100, 50), 360 / 6);
	#colorRidgeMid: Color = this.#drift.color;
	#pathRidge: Path2D = new Path2D();
	#hueBias: number = 0;
	#normLightness: number = 0;
	#silhouette: StemMix = new StemMix(0.5, 1, 1, 1, 1, 1, 1.03);
	#instruments: StemMix = new StemMix(0, 0, 0, 1, 1, 1, 1);
	#kit: StemMix = new StemMix(1, 0, 0, 0, 0, 0, 1);
	#bassline: StemMix = new StemMix(0, 1, 0, 0, 0, 0, 1);
	#voice: StemMix = new StemMix(0, 0, 1, 0, 0, 0, 1);
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
		const { audioset } = host;
		const { volume, subBass } = audioset;
		const drums = this.#drums;
		const bass = this.#bass;
		const vocals = this.#vocals;
		const other = this.#other;

		drums.analyze(this.#kit.mix(audioset), audioset);
		bass.analyze(this.#bassline.mix(audioset), audioset);
		vocals.analyze(this.#voice.mix(audioset), audioset);
		other.analyze(this.#instruments.mix(audioset), audioset);
		this.#drop.push(min(1, drums.percussiveness * 3) * subBass, host);
		this.#percussiveness.push(drums.percussiveness, host);
		this.#bassLevel.push(bass.bassLevel, host);
		this.#subBass.push(bass.subBass, host);
		this.#centroid.push(SpectrumAnalysis.centroid(vocals, other), host);
		this.#high.push(drums.high, host);
		this.#highMid.push(drums.highMid, host);
		this.#flux.push(vocals.spectralFlux + other.spectralFlux, host);
		this.#volume.push(volume, host);
	}

	#runRidgeRotation(host: Host): void {
		const { audioset, environment } = host;

		this.#drift.tick(environment.delta, audioset.volume);
	}

	#runCameraUpdate(host: Host): void {
		const side = this.#side;
		const { context, audioset, environment } = host;
		const { delta } = environment;
		const { beatDetected } = audioset;

		this.#normPulseEnergy = (this.#normPulseEnergy - delta * 4).clamp(0, Infinity);
		if (beatDetected) this.#normPulseEnergy = 1;

		const pulse = 1 + this.#normPulseEnergy * this.#percussiveness.level.lerp(0, 1, 0.03, 0.08);
		const shake = this.#drop.level.lerp(0, 1, 0, side >> 7);
		context.translate(random.number(-1, 1) * shake, random.number(-1, 1) * shake);
		context.scale(pulse, pulse);
	}

	#runRidgeBuilding(host: Host): void {
		const count = this.#count;
		const shaper = Spectrogram.#shaperFrequency;
		const bins = Spectrogram.#bins;
		const peak = this.#side * Spectrogram.#normHeightFactor;
		const colorRidgeSeed = this.#drift.color;
		const { context, audioset } = host;
		const { width } = context.canvas;
		const { volume, spectralCentroid, length } = audioset; // brightness stays on production's own scale
		const dataFrequency = this.#silhouette.mix(audioset);
		const loudness = this.#volume.level;
		const focusBin = (length - 1) / 2;
		const hueBias = this.#hueBias = this.#centroid.level.lerp(0, 1, -40, 40);
		const normLightness = this.#normLightness = meanGeometric(volume.lerp(0, 1, 0.25, 0.75), spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, 0.3, 0.8));
		const envelope = meanGeometric(loudness.lerp(0, 1, 0.7, 1.3), loudness.lerp(0, 1, 0.8, 1.2));
		this.#colorRidgeMid = new Color(colorRidgeSeed).rotate(Spectrogram.#hueSpread * 0.5 + hueBias).illuminate(normLightness);

		const path = this.#pathRidge = new Path2D();
		for (let index = 1 - count; index < count; index++) {
			const direction = sign(index).insteadZero(-1);
			const normProgress = index.lerp(0, direction * (count - 1));
			const normEdge = abs(normProgress - 0.5) * 2;
			const dataIndex = trunc(bins.apply(normEdge) * (length - 1));
			const focusWeight = 1 - abs(dataIndex - focusBin).lerp(0, length, 0, 1) * 0.3;
			const magnitude = (dataFrequency[dataIndex] * normEdge.lerp(0, 1, 1.0, 2.4)).lerp(0, 1.8);
			const normScale = shaper.apply(magnitude) * envelope * focusWeight;
			path.lineTo(width * (normProgress - 0.5), direction * normScale * peak);
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
		const countStops = Spectrogram.#countStops;
		const hueSpread = Spectrogram.#hueSpread;
		const hueBias = this.#hueBias;
		const normLightness = this.#normLightness;
		const colorRidgeSeed = this.#drift.color;
		const pathRidge = this.#pathRidge;
		const { context } = host;
		const { width } = context.canvas;

		const gradientRidge = context.createLinearGradient(-width / 2, 0, width / 2, 0);
		const { hue } = colorRidgeSeed;
		const colorStop = new Color(colorRidgeSeed).illuminate(normLightness);
		for (let index = 0; index <= countStops; index++) {
			const normProgress = index.lerp(0, countStops);
			colorStop.hue = hue + (hueSpread * normProgress + hueBias);
			gradientRidge.addColorStop(normProgress, colorStop.toString());
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
		const peak = this.#side * Spectrogram.#normHeightFactor;
		const sparkle = meanGeometric(this.#high.level, this.#highMid.level);
		const shimmer = this.#flux.level.lerp(0, 1, 0.5, 1);

		context.beginPath();
		for (let index = 0; index < count; index++) {
			const normProgress = index.lerp(0, count - 1);
			const dataIndex = trunc(normProgress.lerp(0, 1, 0, length - 1));
			const normDatumTemporal = dataTemporal[dataIndex].lerp(0, 1, -1, 1);
			const x = width * (normProgress - 0.5);
			const y = normDatumTemporal * volume * peak * 0.6;
			if (index === 0) context.moveTo(x, y);
			else context.lineTo(x, y);
		}
		context.strokeStyle = new Color(colorRidgeMid).pass(shimmer.lerp(0, 1, 0.5, 0.9)).toString();
		context.lineWidth = lineWidth * 0.5;
		context.shadowColor = colorRidgeMid.toString();
		context.shadowBlur = sparkle.lerp(0, 1, 0, lineWidth * 6);
		context.stroke();
	}

	#drawVignette(host: Host): void {
		const colorShadow = Spectrogram.#colorShadow;
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
