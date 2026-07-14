"use strict";

import "adaptive-extender/core";
import { Color, Random, Vector2D } from "adaptive-extender/core";
import { type VisualizationHost } from "../models/visualization.js";
import { Registry, Visualization } from "../services/visualization-registry.js";
import { ColorDriver, Shaper } from "../services/visualization-tools.js";

const { min, sin, cos, sign, PI, abs, trunc, exp, SQRT1_2, meanGeometric } = Math;
const random = Random.global;

//#region Pulsar
Registry.attach("Pulsar", class extends Visualization {
	#radius: number;
	#colorHaloOuter: Color = Color.fromHSL(0, 100, 50);
	#colorHaloInner: Color;
	#gradientHalo: CanvasGradient;
	#shaperFrequency: Shaper = Shaper.sigmoid().then(Shaper.arcsinSaturate);
	#driverHalo: ColorDriver = ColorDriver.rotation;
	#colorShadow: Color;

	//#region Rebuild
	#runMetadataRebuild(host: VisualizationHost): void {
		const { context, environment } = host;
		const { width, height } = context.canvas;
		const { colorBackground } = environment;

		this.#radius = min(width, height) / 2;
		this.#colorHaloInner = Color.fromHSL(colorBackground.hue, colorBackground.saturation, colorBackground.lightness.snap(100));
		this.#colorShadow = Color.fromHSL(colorBackground.hue, colorBackground.saturation, colorBackground.lightness.snap(100));
	}

	#runContextRebuild(host: VisualizationHost): void {
		const radius = this.#radius;
		const { context } = host;
		const { width, height } = context.canvas;

		context.setTransform(1, 0, 0, 1, width / 2, height / 2);
		context.lineWidth = radius >> 8;
	}

	rebuild(host: VisualizationHost): void {
		this.#runMetadataRebuild(host);
		this.#runContextRebuild(host);
	}
	//#endregion
	//#region Update
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

	#runHaloRotation(host: VisualizationHost): void {
		const { audioset, environment } = host;
		this.#driverHalo.tick(this.#colorHaloOuter, 360 / 6, environment.delta, audioset.volume);
	}

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

	#runBackgroundDrawing(host: VisualizationHost): void {
		const { context, environment } = host;
		const { width, height } = context.canvas;
		const { a, d, e, f } = context.getTransform();

		context.globalCompositeOperation = "destination-atop";
		context.fillStyle = environment.colorBackground.toString();
		context.fillRect(-e / a, -f / d, width / a, height / d);
	}

	update(host: VisualizationHost): void {
		this.#runContextUpdate(host);
		this.#runHaloDrawing(host);
		this.#runHaloRotation(host);
		this.#runWaveDrawing(host);
		this.#runShadowDrawing(host);
		this.#runBackgroundDrawing(host);
	}
	//#endregion
});
//#endregion
//#region Spectrogram
Registry.attach("Spectrogram", class extends Visualization {
	#side: number;
	#normPulseEnergy: number = 0;
	#count: number;
	#shaperFrequency: Shaper = Shaper.sigmoid().then(Shaper.arcsinSaturate);
	#normHeightFactor: number = 0.4;
	#colorRidgeSeed: Color = Color.fromHSL(0, 100, 50);
	#driverRidge: ColorDriver = ColorDriver.rotation;
	#deltaRotation: number = 360 / 6;
	#colorShadow: Color = Color.newBlack;

	//#region Rebuild
	#runMetadataRebuild(host: VisualizationHost): void {
		const { context, audioset } = host;
		const { width, height } = context.canvas;
		const { length } = audioset;

		this.#side = min(width, height);
		this.#count = trunc(min(width, length));
	}

	#runContextRebuild(host: VisualizationHost): void {
		const { context } = host;
		const { width, height } = context.canvas;

		context.setTransform(1, 0, 0, 1, width / 2, height / 2);
		context.lineWidth = this.#side >> 8;
	}

	rebuild(host: VisualizationHost): void {
		this.#runMetadataRebuild(host);
		this.#runContextRebuild(host);
	}
	//#endregion
	//#region Update
	#runContextUpdate(host: VisualizationHost): void {
		const side = this.#side;
		const { context, audioset, environment } = host;
		const { width, height } = context.canvas;
		const { dropIntensity, djPunch, beatDetected, percussiveness } = audioset;

		this.#normPulseEnergy = (this.#normPulseEnergy - environment.delta * 0.004).clamp(0, Infinity);
		if (beatDetected) this.#normPulseEnergy = 1;

		const pulse = 1 + this.#normPulseEnergy * percussiveness.lerp(0, 1, 0.03, 0.08);
		const shake = dropIntensity.clamp(0, 0.5).lerp(0, 0.5, 0, side >> 7) * (1 + djPunch);
		let { a, b, c, d, e, f } = context.getTransform();
		a = pulse;
		d = pulse;
		e = width / 2 + random.number(-1, 1) * shake;
		f = height / 2 + random.number(-1, 1) * shake;
		context.setTransform(a, b, c, d, e, f);
		context.clearRect(-e / a, -f / d, width / a, height / d);
	}

	#runRidgeDrawing(host: VisualizationHost): void {
		const count = this.#count;
		const shaper = this.#shaperFrequency;
		const peak = this.#side * this.#normHeightFactor;
		const colorRidgeSeed = this.#colorRidgeSeed;
		const { context, audioset } = host;
		const { dataFrequency, volume, amplitude, bassLevel, spectralCentroid, djTilt, djBoost, djSpread, djFocus, length } = audioset;
		const { width } = context.canvas;
		const { lineWidth } = context;
		const focusBin = djFocus.lerp(-100, -20, 0, length - 1);
		const hueSpread = djSpread.lerp(1, 59, 90, 150);
		const hueBias = spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, -40, 40) + djTilt.lerp(-12, 12, -25, 25);
		const normLightness = meanGeometric(volume.lerp(0, 1, 0.25, 0.75), spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, 0.3, 0.8));
		const envelope = meanGeometric(volume.lerp(0, 1, 0.7, 1.3), amplitude.lerp(0, 1, 0.8, 1.2));
		const gradientRidge = context.createLinearGradient(-width / 2, 0, width / 2, 0);

		context.beginPath();
		const position = Vector2D.newNaN;
		for (let index = 1 - count; index < count; index++) {
			const direction = sign(index).insteadZero(-1);
			const normProgress = index.lerp(0, direction * (count - 1));
			const normEdge = abs(normProgress - 0.5) * 2;
			const dataIndex = trunc((exp(normEdge * 3) - 1) / (exp(3) - 1) * (length - 1));
			const focusWeight = 1 - abs(dataIndex - focusBin).lerp(0, length, 0, 1) * 0.3;
			const magnitude = (dataFrequency[dataIndex] * normEdge.lerp(0, 1, 1.0, 2.4)).clamp(-Infinity, 1);
			const normScale = shaper.apply(magnitude) * envelope * focusWeight;
			position.x = width * (normProgress - 0.5);
			position.y = direction * normScale * peak;
			if (direction > 0) gradientRidge.addColorStop(normProgress, new Color(colorRidgeSeed)
				.rotate(hueSpread * normProgress + hueBias)
				.illuminate(normLightness)
				.toString()
			);
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

	#runRidgeRotation(host: VisualizationHost): void {
		const { audioset, environment } = host;
		this.#driverRidge.tick(this.#colorRidgeSeed, this.#deltaRotation, environment.delta, audioset.amplitude);
	}

	#runBloomDrawing(host: VisualizationHost): void {
		const colorRidgeSeed = this.#colorRidgeSeed;
		const { context, audioset } = host;
		const { subBass, bass, bassLevel } = audioset;
		const bloomEnergy = meanGeometric(subBass.clamp(0, 0.8).lerp(0, 0.8, 0, 1), bass.clamp(0, 0.8).lerp(0, 0.8, 0, 1));
		const radius = this.#side * bloomEnergy.lerp(0, 1, 0.05, 0.22);

		const gradientBloom = context.createRadialGradient(0, 0, 0, 0, 0, radius);
		gradientBloom.addColorStop(0, colorRidgeSeed.pass(bassLevel.clamp(0, 0.6).lerp(0, 0.6, 0.15, 0.45)).toString());
		gradientBloom.addColorStop(1, colorRidgeSeed.pass(0).toString());
		context.globalCompositeOperation = "lighter";
		context.fillStyle = gradientBloom;
		context.beginPath();
		context.arc(0, 0, radius, 0, 2 * PI);
		context.fill();
	}

	#runThreadDrawing(host: VisualizationHost): void {
		const count = this.#count;
		const colorRidgeSeed = this.#colorRidgeSeed;
		const { context, audioset } = host;
		const { dataTemporal, amplitude, spectralFlux, high, highMid, length } = audioset;
		const { width } = context.canvas;
		const { lineWidth } = context;
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
		context.globalCompositeOperation = "lighter";
		context.strokeStyle = colorRidgeSeed.pass(shimmer.lerp(0, 1, 0.5, 0.9)).toString();
		context.lineWidth = lineWidth * 0.5;
		context.shadowOffsetX = 0;
		context.shadowOffsetY = 0;
		context.shadowColor = colorRidgeSeed.toString();
		context.shadowBlur = sparkle.lerp(0, 1, 0, lineWidth * 6);
		context.stroke();
		context.shadowBlur = 0;
		context.lineWidth = lineWidth;
	}

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

	#runBackgroundDrawing(host: VisualizationHost): void {
		const { context, environment } = host;
		const { width, height } = context.canvas;
		const { a, d, e, f } = context.getTransform();

		context.globalCompositeOperation = "destination-atop";
		context.fillStyle = environment.colorBackground.toString();
		context.fillRect(-e / a, -f / d, width / a, height / d);
	}
	

	update(host: VisualizationHost): void {
		this.#runContextUpdate(host);
		this.#runRidgeDrawing(host);
		this.#runRidgeRotation(host);
		this.#runBloomDrawing(host);
		this.#runThreadDrawing(host);
		this.#runVignetteDrawing(host);
		this.#runBackgroundDrawing(host);
	}
	//#endregion
});
//#endregion
