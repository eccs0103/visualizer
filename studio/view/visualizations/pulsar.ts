"use strict";

import "adaptive-extender/core";
import { Color, Random, Vector2D } from "adaptive-extender/core";
import { type VisualizationHost } from "../../models/visualization.js";
import { Registry, Visualization } from "../../services/visualization-registry.js";
import { ColorDriver, Shaper } from "../../services/visualization-tools.js";

const { min, sin, cos, PI, abs, trunc, SQRT1_2, meanGeometric } = Math;
const random = Random.global;

//#region Pulsar
Registry.attach("Pulsar", class extends Visualization {
	#radius: number;
	#colorHaloOuter: Color = Color.fromHSL(0, 100, 60);
	#colorHaloInner: Color;
	#gradientHalo: CanvasGradient;
	#shaperFrequency: Shaper = Shaper.sigmoid().then(Shaper.arcsinSaturate);
	#driverHalo: ColorDriver = ColorDriver.rotation;
	#colorShadow: Color;

	//#region Rebuild
	#runMetadataRebuild(host: VisualizationHost): void {
		const { context, environment } = host;
		const { width, height } = context.canvas;
		const { hue, saturation, lightness } = environment.colorBackground;

		this.#radius = min(width, height) / 2;
		this.#colorHaloInner = Color.fromHSL(hue, saturation, lightness.snap(100));
		this.#colorShadow = Color.fromHSL(hue, saturation, lightness.snap(100));
	}

	#runContextRebuild(host: VisualizationHost): void {
		const radius = this.#radius;
		const { context } = host;
		const { width, height } = context.canvas;

		context.setTransform(1, 0, 0, 1, width / 2, height / 2);
		context.lineWidth = radius >> 7;
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
		const shaperFrequency = this.#shaperFrequency;
		const { context, audioset } = host;
		const { dataFrequency, volume, bassLevel, spectralCentroid, djTilt, djBoost, length } = audioset;
		const semiLength = length / 2;
		const hueBias = spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, -30, 30) + djTilt.lerp(-12, 12, -20, 20);
		const normIllumination = meanGeometric(volume.lerp(0, 1, 0.1, 1.0), bassLevel.clamp(0, 0.6).lerp(0, 0.6, 0.5, 1.0));

		const gradientHalo = this.#gradientHalo = context.createConicGradient(PI / 2, 0, 0);
		context.beginPath();
		const position = Vector2D.newNaN;
		for (let index = 0; index < length; index++) {
			const normProgress = index.lerp(0, length);
			const normOffset = abs(index - semiLength).lerp(0, semiLength + 1);
			gradientHalo.addColorStop(normProgress, new Color(colorHaloOuter)
				.rotate(180 * normOffset + hueBias)
				.illuminate(normIllumination)
				.toString());
			const normScale = shaperFrequency.apply(dataFrequency[trunc(normOffset * semiLength)]);
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
		context.shadowBlur = bassLevel.clamp(0, 0.6).lerp(0, 0.6, radius >> 6, radius >> 3) * djBoost.lerp(0.25, 1.75, 0.8, 1.2);
		context.stroke();
		context.shadowBlur = 0;
	}

	#runHaloRotation(host: VisualizationHost): void {
		const driverHalo = this.#driverHalo;
		const colorHaloOuter = this.#colorHaloOuter;
		const { audioset, environment } = host;

		driverHalo.tick(colorHaloOuter, 360 / 6, environment.delta, audioset.volume);
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
