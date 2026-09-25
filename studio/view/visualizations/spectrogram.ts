"use strict";

import "adaptive-extender/core";
import { Color, Random, Vector2D } from "adaptive-extender/core";
import { Blend } from "../../models/blend.js";
import { type StageHost, type VisualizationHost } from "../../models/visualization.js";
import { Registry, Visualization } from "../../services/visualization-registry.js";
import { ColorDriver, Shaper, Stem, Stems } from "../../services/visualization-tools.js";

const { min, sign, PI, abs, trunc, exp, meanGeometric } = Math;
const random = Random.global;

//#region Spectrogram
Registry.attach("Spectrogram", class extends Visualization {
	#layerRidge = this.newCustomLayer("Ridge", this.#drawRidge.bind(this));
	#layerOther = this.newCustomLayer("Other", host => this.#drawStem(host, Stem.Other), { blend: Blend.lighter });
	#layerVocals = this.newCustomLayer("Vocals", host => this.#drawStem(host, Stem.Vocals), { blend: Blend.lighter });
	#layerBass = this.newCustomLayer("Bass", host => this.#drawStem(host, Stem.Bass), { blend: Blend.lighter });
	#layerDrums = this.newCustomLayer("Drums", host => this.#drawStem(host, Stem.Drums), { blend: Blend.lighter });
	#layerBloom = this.newCustomLayer("Bloom", this.#drawBloom.bind(this), { blend: Blend.lighter });
	#layerThread = this.newCustomLayer("Thread", this.#drawThread.bind(this), { blend: Blend.lighter });
	#layerVignette = this.newCustomLayer("Vignette", this.#drawVignette.bind(this), { blend: Blend.multiply });
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
	#driverRidge: ColorDriver = ColorDriver.rotation;
	#deltaRotation: number = 360 / 6;
	#colorShadow: Color = Color.newBlack;
	#gainStem: number = 2; // a stem is only a share of the mix, so it needs some gain to clear the shaper's knee, which is tuned for the full mix
	#palette: string[] = [];
	#horizontal: Float32Array = new Float32Array(0);
	#heights: Float32Array[] = [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)];

	//#region Rebuild
	rebuild(stage: StageHost): void {
		const { width, height, audioset } = stage;
		const { length } = audioset;

		this.#side = min(width, height);
		this.#lineWidth = this.#side >> 8;
		this.#count = trunc(min(width, length));

		const size = 2 * this.#count - 1;
		if (this.#horizontal.length !== size) {
			this.#horizontal = new Float32Array(size);
			this.#heights = this.#heights.map(() => new Float32Array(size));
		}
	}
	//#endregion
	//#region Update
	#runRidgeRotation(stage: StageHost): void {
		const driverRidge = this.#driverRidge;
		const colorRidgeSeed = this.#colorRidgeSeed;
		const deltaRotation = this.#deltaRotation;
		const { audioset, environment } = stage;

		driverRidge.tick(colorRidgeSeed, deltaRotation, environment.delta, audioset.amplitude);
	}

	#runCameraUpdate(stage: StageHost): void {
		const side = this.#side;
		const { camera, audioset, environment } = stage;
		const { dropIntensity, djPunch, beatDetected, percussiveness } = audioset;

		this.#normPulseEnergy = (this.#normPulseEnergy - environment.delta * 0.004).clamp(0, Infinity);
		if (beatDetected) this.#normPulseEnergy = 1;

		const pulse = 1 + this.#normPulseEnergy * percussiveness.lerp(0, 1, 0.03, 0.08);
		const shake = dropIntensity.clamp(0, 0.5).lerp(0, 0.5, 0, side >> 7) * (1 + djPunch);
		camera.translateSelf(random.number(-1, 1) * shake, random.number(-1, 1) * shake).scaleSelf(pulse);
	}

	#runRidgeBuilding(stage: StageHost): void {
		const count = this.#count;
		const shaper = this.#shaperFrequency;
		const peak = this.#side * this.#normHeightFactor;
		const colorRidgeSeed = this.#colorRidgeSeed;
		const { width, audioset } = stage;
		const { dataFrequency, volume, amplitude, spectralCentroid, djTilt, djSpread, djFocus, length } = audioset;
		const focusBin = djFocus.lerp(-100, -20, 0, length - 1);
		const hueSpread = this.#hueSpread = djSpread.lerp(1, 59, 90, 150);
		const hueBias = this.#hueBias = spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, -40, 40) + djTilt.lerp(-12, 12, -25, 25);
		const normLightness = this.#normLightness = meanGeometric(volume.lerp(0, 1, 0.25, 0.75), spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, 0.3, 0.8));
		const envelope = meanGeometric(volume.lerp(0, 1, 0.7, 1.3), amplitude.lerp(0, 1, 0.8, 1.2));
		this.#colorRidgeMid = new Color(colorRidgeSeed).rotate(hueSpread * 0.5 + hueBias).illuminate(normLightness);
		this.#palette = Stems.palette(colorRidgeSeed, hueBias, normLightness);

		// Each stem's own ridge: the same shaping as the mix, applied to its own isolated spectrum.
		const horizontal = this.#horizontal, heights = this.#heights;
		const spectra = Stems.spectra(audioset);
		let point = 0;

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

			horizontal[point] = position.x;
			for (let stem = 0; stem < heights.length; stem++) {
				const magnitudeStem = (spectra[stem][dataIndex] * this.#gainStem * normEdge.lerp(0, 1, 1.0, 2.4)).lerp(0, 1.8);
				heights[stem][point] = direction * shaper.apply(magnitudeStem) * envelope * focusWeight * peak;
			}
			point++;
		}
		path.closePath();
	}

	update(stage: StageHost): void {
		this.#runRidgeRotation(stage);
		this.#runCameraUpdate(stage);
		this.#runRidgeBuilding(stage);
	}
	//#endregion
	//#region Layers
	#drawRidge(host: VisualizationHost): void {
		const lineWidth = this.#lineWidth;
		const countStops = this.#countStops;
		const hueSpread = this.#hueSpread;
		const hueBias = this.#hueBias;
		const normLightness = this.#normLightness;
		const colorRidgeSeed = this.#colorRidgeSeed;
		const pathRidge = this.#pathRidge;
		const { context, audioset } = host;
		const { bassLevel, djBoost } = audioset;
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
		const blurRidge = trunc(bassLevel.clamp(0, 0.6).lerp(0, 0.6, lineWidth * 2, lineWidth * 10) * djBoost.lerp(0.25, 1.75, 0.8, 1.2) / 2);
		if (blurRidge >= 1) {
			context.filter = `blur(${blurRidge}px)`;
			context.fill(pathRidge);
			context.filter = "none";
		}
		context.fill(pathRidge);
	}

	#drawStem(host: VisualizationHost, stem: Stem): void {
		const lineWidth = this.#lineWidth;
		const horizontal = this.#horizontal, height = this.#heights[stem];
		const { context, audioset } = host;
		const { bassLevel, djBoost } = audioset;
		const size = horizontal.length;

		context.beginPath();
		for (let point = 0; point < size; point++) {
			if (point === 0) context.moveTo(horizontal[point], height[point]);
			else context.lineTo(horizontal[point], height[point]);
		}
		context.lineTo(horizontal[size - 1], 0);
		context.lineTo(horizontal[0], 0);
		context.closePath();
		context.fillStyle = this.#palette[stem];
		const blurRidge = trunc(bassLevel.clamp(0, 0.6).lerp(0, 0.6, lineWidth * 2, lineWidth * 10) * djBoost.lerp(0.25, 1.75, 0.8, 1.2) / 2);
		if (blurRidge >= 1) {
			context.filter = `blur(${blurRidge}px)`;
			context.fill();
			context.filter = "none";
		}
		context.fill();
	}

	#drawBloom(host: VisualizationHost): void {
		const colorRidgeMid = this.#colorRidgeMid;
		const { context, audioset } = host;
		const { subBass, bass, bassLevel } = audioset;
		const bloomEnergy = meanGeometric(subBass.clamp(0, 0.8).lerp(0, 0.8, 0, 1), bass.clamp(0, 0.8).lerp(0, 0.8, 0, 1));
		const radius = this.#side * bloomEnergy.lerp(0, 1, 0.05, 0.22);

		const gradientBloom = context.createRadialGradient(0, 0, 0, 0, 0, radius);
		gradientBloom.addColorStop(0, new Color(colorRidgeMid).pass(bassLevel.clamp(0, 0.6).lerp(0, 0.6, 0.15, 0.45)).toString());
		gradientBloom.addColorStop(1, new Color(colorRidgeMid).pass(0).toString());
		context.fillStyle = gradientBloom;
		context.beginPath();
		context.arc(0, 0, radius, 0, 2 * PI);
		context.fill();
	}

	#drawThread(host: VisualizationHost): void {
		const count = this.#count;
		const lineWidth = this.#lineWidth;
		const colorRidgeMid = this.#colorRidgeMid;
		const { context, audioset } = host;
		const { dataTemporal, amplitude, spectralFlux, high, highMid, length } = audioset;
		const { width } = context.canvas;
		const peak = this.#side * this.#normHeightFactor;
		const sparkle = meanGeometric(high.clamp(0, 0.5).lerp(0, 0.5, 0, 1), highMid.clamp(0, 0.6).lerp(0, 0.6, 0, 1));
		const shimmer = spectralFlux.clamp(0, 0.3).lerp(0, 0.3, 0.5, 1);

		context.beginPath();
		const position = Vector2D.newNaN;
		for (let index = 0; index < count; index++) {
			const normProgress = index.lerp(0, count - 1);
			const dataIndex = trunc(normProgress.lerp(0, 1, 0, length - 1));
			const normDatumTemporal = dataTemporal[dataIndex].lerp(0, 1, -1, 1);
			position.x = width * (normProgress - 0.5);
			position.y = normDatumTemporal * amplitude * peak * 0.6;
			if (index === 0) context.moveTo(position.x, position.y);
			else context.lineTo(position.x, position.y);
		}
		context.strokeStyle = new Color(colorRidgeMid).pass(shimmer.lerp(0, 1, 0.5, 0.9)).toString();
		context.lineWidth = lineWidth * 0.5;
		context.shadowColor = colorRidgeMid.toString();
		context.shadowBlur = sparkle.lerp(0, 1, 0, lineWidth * 6);
		context.stroke();
	}

	#drawVignette(host: VisualizationHost): void {
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
