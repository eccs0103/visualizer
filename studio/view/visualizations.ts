"use strict";

import "adaptive-extender/core";
import { Color, Random, Vector2D } from "adaptive-extender/core";
import { type VisualizationHost } from "../models/visualization.js";
import { Registry, Visualization } from "../services/visualization-registry.js";
import { ColorDriver, Shaper } from "../services/visualization-tools.js";

const { min, max, sin, cos, PI, abs, trunc, SQRT1_2, meanGeometric } = Math;
const random = Random.global;

//#region Pulsar
Registry.attach("Pulsar", class extends Visualization {
	//#region Rebuild preparation
	#radius: number;
	#colorBackground: Color;

	#runMetadataRebuild(host: VisualizationHost): void {
		const { context, environment } = host;
		const { width, height } = context.canvas;

		this.#radius = min(width, height) / 2;
		this.#colorBackground = environment.colorBackground;
	}

	#runContextRebuild(host: VisualizationHost): void {
		const radius = this.#radius;
		const { context } = host;
		const { width, height } = context.canvas;

		context.setTransform(1, 0, 0, 1, width / 2, height / 2);
		context.lineWidth = radius >> 8;
	}
	//#endregion

	rebuild(host: VisualizationHost): void {
		this.#runMetadataRebuild(host);
		this.#runContextRebuild(host);
	}

	//#region Update preparation
	#runContextUpdate(host: VisualizationHost): void {
		const radius = this.#radius;
		const { context, audioset } = host;
		const { width, height } = context.canvas;
		const { dropIntensity, djPunch } = audioset;

		let { a, b, c, d, e, f } = context.getTransform();
		const shake = dropIntensity.clamp(0, 0.5).lerp(0, 0.5, 0, radius >> 6) * (1 + djPunch);
		e = width / 2 + random.number(-1, 1) * shake;
		f = height / 2 + random.number(-1, 1) * shake;
		context.setTransform(a, b, c, d, e, f);
		context.clearRect(-e / a, -f / d, width / a, height / d);
	}
	//#endregion
	//#region Halo
	#colorHaloOuter: Color = Color.fromHSL(0, 100, 50);
	#colorHaloInner: Color = Color.newBlack;
	#gradientHalo: CanvasGradient;
	#shaperFrequency: Shaper = Shaper.sigmoid().then(Shaper.arcsinSaturate);

	#runHaloDrawing(host: VisualizationHost): void {
		const radius = this.#radius;
		const colorHaloOuter = this.#colorHaloOuter;
		const colorHaloInner = this.#colorHaloInner;
		const { context, audioset } = host;
		const { dataFrequency, volume, bassLevel, spectralCentroid, djTilt, djBoost, length } = audioset;
		const semiLength = length / 2;
		const hueBias = spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, -30, 30) + djTilt.lerp(-12, 12, -20, 20);
		const normIllumination = meanGeometric(volume.lerp(0, 1, 0.1, 1.0), bassLevel.clamp(0, 0.6).lerp(0, 0.6, 0.3, 1.0));

		const gradientHalo = this.#gradientHalo = context.createConicGradient(PI / 2, 0, 0);
		context.beginPath();
		const position = Vector2D.newNaN;
		for (let index = 0; index < length; index++) {
			const normProgress = index.lerp(0, length);
			const normOffset = abs(index - semiLength).lerp(0, semiLength + 1);
			gradientHalo.addColorStop(normProgress, new Color(colorHaloOuter)
				.rotate(180 * normOffset + hueBias)
				.illuminate(normIllumination)
				.toString()
			);
			const normScale = this.#shaperFrequency.apply(dataFrequency[trunc(normOffset * semiLength)]);
			const distance = normScale.lerp(0, 1, 0.6, 1.0) * radius;
			position.x = distance * sin(normProgress * 2 * PI);
			position.y = distance * cos(normProgress * 2 * PI);
			context.lineTo(position.x, position.y);
		}
		context.closePath();
		context.globalCompositeOperation = "source-over";
		context.fillStyle = colorHaloInner.toString();
		context.fill();
		context.strokeStyle = gradientHalo;
		context.shadowOffsetX = 0;
		context.shadowOffsetY = 0;
		context.shadowColor = colorHaloOuter.toString();
		context.shadowBlur = bassLevel.clamp(0, 0.6).lerp(0, 0.6, radius >> 7, radius >> 4) * djBoost.lerp(0.25, 1.75, 0.8, 1.2);
		context.stroke();
		context.shadowBlur = 0;
	}

	#driverHalo: ColorDriver = ColorDriver.rotation;

	#runHaloRotation(host: VisualizationHost): void {
		const { audioset, environment } = host;
		this.#driverHalo.tick(this.#colorHaloOuter, 360 / 6, environment.delta, audioset.volume);
	}
	//#endregion
	//#region Wave
	#runWaveDrawing(host: VisualizationHost): void {
		const radius = this.#radius;
		const gradientHalo = this.#gradientHalo;
		const { context, audioset } = host;
		const { dataTemporal, amplitude, percussiveness, length } = audioset;
		const { width } = context.canvas;
		const scalePercussive = percussiveness.lerp(0, 1, 1.0, 1.15);

		context.beginPath();
		context.moveTo(-width / 2, 0);
		const position = Vector2D.newNaN;
		for (let index = 0; index < length; index++) {
			const normProgress = index.lerp(0, length);
			const normDatumTemporal = dataTemporal[trunc(normProgress * length)].lerp(0, 1, -1, 1);
			const normScale = normDatumTemporal * amplitude * scalePercussive;
			position.x = width * (normProgress - 0.5);
			position.y = radius * normScale;
			context.lineTo(position.x, position.y);
		}
		context.lineTo(width / 2, 0);
		context.globalCompositeOperation = "source-atop";
		context.fillStyle = gradientHalo;
		context.fill();
		context.strokeStyle = gradientHalo;
		context.stroke();
	}
	//#endregion
	//#region Shadow
	#colorShadow: Color = Color.newBlack;

	#runShadowDrawing(host: VisualizationHost): void {
		const radius = this.#radius;
		const colorShadow = this.#colorShadow;
		const { context } = host;

		const gradientShadow = context.createRadialGradient(0, 0, 0, 0, 0, radius);
		gradientShadow.addColorStop(0, colorShadow.pass(1).toString());
		gradientShadow.addColorStop(0.5, colorShadow.pass(SQRT1_2).toString());
		gradientShadow.addColorStop(1, colorShadow.pass(0).toString());
		context.globalCompositeOperation = "source-over";
		context.fillStyle = gradientShadow;
		context.fill();
	}
	//#endregion
	//#region Background
	#runBackgroundDrawing(host: VisualizationHost): void {
		const colorBackground = this.#colorBackground;
		const { context } = host;
		const { width, height } = context.canvas;
		const { a, d, e, f } = context.getTransform();

		context.globalCompositeOperation = "destination-atop";
		context.fillStyle = colorBackground.toString();
		context.fillRect(-e / a, -f / d, width / a, height / d);
	}
	//#endregion

	update(host: VisualizationHost): void {
		this.#runContextUpdate(host);

		this.#runHaloDrawing(host);
		this.#runHaloRotation(host);

		this.#runWaveDrawing(host);

		this.#runShadowDrawing(host);

		this.#runBackgroundDrawing(host);
	}
});
//#endregion
//#region Spectrogram
Registry.attach("Spectrogram", class extends Visualization {
	//#region Rebuild preparation
	#halfHeightFactor: number = 0.32;
	#deltaRotation: number;
	#colorBackground: Color;

	#runMetadataRebuild(host: VisualizationHost): void {
		const { environment } = host;
		this.#deltaRotation = 360 / 6;
		this.#colorBackground = environment.colorBackground;
	}

	#runContextRebuild(host: VisualizationHost): void {
		const { context } = host;
		const { width, height } = context.canvas;

		context.setTransform(1, 0, 0, 1, width / 2, height / 2);

		context.lineWidth = min(width, height) >> 8;
	}
	//#endregion

	rebuild(host: VisualizationHost): void {
		this.#runMetadataRebuild(host);
		this.#runContextRebuild(host);
	}

	//#region Update preparation
	#pulseEnergy: number = 0;

	#runContextUpdate(host: VisualizationHost): void {
		const { context, audioset, environment } = host;
		const { dropIntensity, djPunch, beatDetected, percussiveness } = audioset;
		const { width, height } = context.canvas;
		const shortEdge = min(width, height);

		this.#pulseEnergy = max(0, this.#pulseEnergy - environment.delta * 0.004);
		if (beatDetected) this.#pulseEnergy = 1;

		let { a, b, c, d, e, f } = context.getTransform();
		const pulse = 1 + this.#pulseEnergy * percussiveness.lerp(0, 1, 0.03, 0.08);
		a = pulse;
		d = pulse;
		const shake = dropIntensity.clamp(0, 0.5).lerp(0, 0.5, 0, shortEdge >> 7) * (1 + djPunch);
		e = width / 2 + random.number(-1, 1) * shake;
		f = height / 2 + random.number(-1, 1) * shake;
		context.setTransform(a, b, c, d, e, f);
		context.clearRect(-e / a, -f / d, width / a, height / d);
	}
	//#endregion
	//#region Ridge
	#colorRidgeSeed: Color = Color.fromHSL(0, 100, 50);
	#shaperFrequency: Shaper = Shaper.sigmoid().then(Shaper.arcsinSaturate);

	#runRidgeDrawing(host: VisualizationHost): void {
		const colorRidgeSeed = this.#colorRidgeSeed;
		const shaper = this.#shaperFrequency;
		const { context, audioset } = host;
		const { dataFrequency, volume, amplitude, bassLevel, spectralCentroid, djTilt, djBoost, djSpread, djFocus, length } = audioset;
		const { width, height } = context.canvas;
		const halfHeight = min(width, height) * this.#halfHeightFactor;
		const lineWidth = context.lineWidth;
		const binCount = trunc(min(length, width));
		const focusBin = djFocus.lerp(-100, -20, 0, length - 1);

		const hueSpread = djSpread.lerp(1, 59, 90, 150);
		const hueBias = spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, -40, 40) + djTilt.lerp(-12, 12, -25, 25);
		const normLightness = meanGeometric(volume.lerp(0, 1, 0.25, 0.75), spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, 0.3, 0.8));
		const envelope = meanGeometric(volume.lerp(0, 1, 0.7, 1.3), amplitude.lerp(0, 1, 0.8, 1.2));

		const gradientRidge = context.createLinearGradient(-width / 2, 0, width / 2, 0);
		context.beginPath();
		const position = Vector2D.newNaN;
		for (let bin = 0; bin < binCount; bin++) {
			const normProgress = bin.lerp(0, binCount - 1);
			const dataIndex = trunc(normProgress.lerp(0, 1, 0, length - 1));
			const focusWeight = 1 - abs(dataIndex - focusBin).lerp(0, length, 0, 1) * 0.3;
			const normScale = shaper.apply(dataFrequency[dataIndex]) * envelope * focusWeight;
			position.x = width * (normProgress - 0.5);
			position.y = -normScale * halfHeight;
			gradientRidge.addColorStop(normProgress, new Color(colorRidgeSeed)
				.rotate(hueSpread * normProgress + hueBias)
				.illuminate(normLightness)
				.toString()
			);
			context.lineTo(position.x, position.y);
		}
		for (let bin = binCount - 1; bin >= 0; bin--) {
			const normProgress = bin.lerp(0, binCount - 1);
			const dataIndex = trunc(normProgress.lerp(0, 1, 0, length - 1));
			const focusWeight = 1 - abs(dataIndex - focusBin).lerp(0, length, 0, 1) * 0.3;
			const normScale = shaper.apply(dataFrequency[dataIndex]) * envelope * focusWeight;
			position.x = width * (normProgress - 0.5);
			position.y = normScale * halfHeight;
			context.lineTo(position.x, position.y);
		}
		context.closePath();
		context.globalCompositeOperation = "source-over";
		context.fillStyle = gradientRidge;
		context.shadowOffsetX = 0;
		context.shadowOffsetY = 0;
		context.shadowColor = colorRidgeSeed.toString();
		context.shadowBlur = bassLevel.clamp(0, 0.6).lerp(0, 0.6, lineWidth * 2, lineWidth * 10) * djBoost.lerp(0.25, 1.75, 0.8, 1.2);
		context.fill();
		context.shadowBlur = 0;
	}

	#driverRidge: ColorDriver = ColorDriver.rotation;

	#runRidgeRotation(host: VisualizationHost): void {
		const { audioset, environment } = host;
		this.#driverRidge.tick(this.#colorRidgeSeed, this.#deltaRotation, environment.delta, audioset.amplitude);
	}
	//#endregion
	//#region Bloom
	#runBloomDrawing(host: VisualizationHost): void {
		const colorRidgeSeed = this.#colorRidgeSeed;
		const { context, audioset } = host;
		const { subBass, bass, bassLevel } = audioset;
		const { width, height } = context.canvas;
		const shortEdge = min(width, height);
		const bloomEnergy = meanGeometric(subBass.clamp(0, 0.8).lerp(0, 0.8, 0, 1), bass.clamp(0, 0.8).lerp(0, 0.8, 0, 1));
		const radius = shortEdge * bloomEnergy.lerp(0, 1, 0.05, 0.22);

		const gradientBloom = context.createRadialGradient(0, 0, 0, 0, 0, radius);
		gradientBloom.addColorStop(0, colorRidgeSeed.pass(bassLevel.clamp(0, 0.6).lerp(0, 0.6, 0.15, 0.45)).toString());
		gradientBloom.addColorStop(1, colorRidgeSeed.pass(0).toString());
		context.globalCompositeOperation = "lighter";
		context.fillStyle = gradientBloom;
		context.beginPath();
		context.arc(0, 0, radius, 0, 2 * PI);
		context.fill();
	}
	//#endregion
	//#region Thread
	#runThreadDrawing(host: VisualizationHost): void {
		const colorRidgeSeed = this.#colorRidgeSeed;
		const { context, audioset } = host;
		const { dataTemporal, amplitude, spectralFlux, high, highMid, length } = audioset;
		const { width, height } = context.canvas;
		const halfHeight = min(width, height) * this.#halfHeightFactor;
		const lineWidthBase = context.lineWidth;
		const threadCount = trunc(min(length, width));
		const sparkle = meanGeometric(high.clamp(0, 0.5).lerp(0, 0.5, 0, 1), highMid.clamp(0, 0.6).lerp(0, 0.6, 0, 1));
		const shimmer = spectralFlux.clamp(0, 0.3).lerp(0, 0.3, 0.5, 1);

		context.beginPath();
		const position = Vector2D.newNaN;
		for (let bin = 0; bin < threadCount; bin++) {
			const normProgress = bin.lerp(0, threadCount - 1);
			const dataIndex = trunc(normProgress.lerp(0, 1, 0, length - 1));
			const normDatumTemporal = dataTemporal[dataIndex].lerp(0, 1, -1, 1);
			position.x = width * (normProgress - 0.5);
			position.y = normDatumTemporal * amplitude * halfHeight * 0.6;
			if (bin === 0) context.moveTo(position.x, position.y);
			else context.lineTo(position.x, position.y);
		}
		context.globalCompositeOperation = "lighter";
		context.strokeStyle = colorRidgeSeed.pass(shimmer.lerp(0, 1, 0.5, 0.9)).toString();
		context.lineWidth = lineWidthBase * 0.5;
		context.shadowOffsetX = 0;
		context.shadowOffsetY = 0;
		context.shadowColor = colorRidgeSeed.toString();
		context.shadowBlur = sparkle.lerp(0, 1, 0, lineWidthBase * 6);
		context.stroke();
		context.shadowBlur = 0;
		context.lineWidth = lineWidthBase;
	}
	//#endregion
	//#region Vignette
	#colorShadow: Color = Color.newBlack;

	#runVignetteDrawing(host: VisualizationHost): void {
		const colorShadow = this.#colorShadow;
		const { context } = host;
		const { width, height } = context.canvas;
		const { a, d, e, f } = context.getTransform();

		const gradientVignette = context.createLinearGradient(e, -f, e, f);
		gradientVignette.addColorStop(0, colorShadow.pass(0.45).toString());
		gradientVignette.addColorStop(0.5, colorShadow.pass(0).toString());
		gradientVignette.addColorStop(1, colorShadow.pass(0.45).toString());
		context.globalCompositeOperation = "multiply";
		context.fillStyle = gradientVignette;
		context.fillRect(-e / a, -f / d, width / a, height / d);
	}
	//#endregion
	//#region Background
	#runBackgroundDrawing(host: VisualizationHost): void {
		const colorBackground = this.#colorBackground;
		const { context } = host;
		const { width, height } = context.canvas;
		const { a, d, e, f } = context.getTransform();

		context.globalCompositeOperation = "destination-atop";
		context.fillStyle = colorBackground.toString();
		context.fillRect(-e / a, -f / d, width / a, height / d);
	}
	//#endregion

	update(host: VisualizationHost): void {
		this.#runContextUpdate(host);

		this.#runRidgeDrawing(host);
		this.#runRidgeRotation(host);

		this.#runBloomDrawing(host);

		this.#runThreadDrawing(host);

		this.#runVignetteDrawing(host);

		this.#runBackgroundDrawing(host);
	}
});
//#endregion
