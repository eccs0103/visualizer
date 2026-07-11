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
	#normShadowAnchor: number = 0.8;
	#deltaRotation: number;
	#colorGrid: Color;

	#runMetadataRebuild(host: VisualizationHost): void {
		const { environment } = host;
		this.#deltaRotation = 360 / 6;

		const colorGrid = this.#colorGrid = environment.colorBackground;
		colorGrid.lightness = (colorGrid.lightness / 100).lerp(0, 1, 0.1, 0.9) * 100;
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
	#runContextUpdate(host: VisualizationHost): void {
		const { context, audioset } = host;
		const { volume, amplitude, dropIntensity, djPunch } = audioset;
		const { width, height } = context.canvas;

		let { a, b, c, d, e, f } = context.getTransform();
		a = volume.lerp(0, 1, 1.0, 1.2);
		d = amplitude.lerp(0, 1, 1.0, 1.4);
		const shake = dropIntensity.clamp(0, 0.5).lerp(0, 0.5, 0, min(width, height) >> 7) * (1 + djPunch);
		e = width / 2 + random.number(-1, 1) * shake;
		f = height / 2 + random.number(-1, 1) * shake;
		context.setTransform(a, b, c, d, e, f);
		context.clearRect(-e / a, -f / d, width / a, height / d);
	}
	//#endregion
	//#region Grid
	#runGridDrawing(host: VisualizationHost): void {
		const colorGrid = this.#colorGrid;
		const { context } = host;
		const { width, height } = context.canvas;
		const step = 4 * context.lineWidth;

		const position = Vector2D.newNaN;
		position.y = -height / 2;
		context.beginPath();
		// Grid render loop optimization
		for (position.x = -trunc(width / step) * step / 2; position.x < width; position.x += step) {
			context.moveTo(position.x, position.y);
			context.lineTo(position.x, position.y + height);
		}
		position.x = -width / 2;
		for (position.y = -trunc(height / step) * step / 2; position.y < height; position.y += step) {
			context.moveTo(position.x, position.y);
			context.lineTo(position.x + width, position.y);
		}
		context.globalCompositeOperation = "source-over";
		context.strokeStyle = colorGrid.toString();
		context.stroke();
	}
	//#endregion
	//#region Spectrum
	#colorSpectrumSeed: Color = Color.fromHSL(0, 100, 50);

	#runSpectrumDrawing(host: VisualizationHost): void {
		const normShadowAnchor = this.#normShadowAnchor;
		const colorSpectrumSeed = this.#colorSpectrumSeed;
		const deltaRotation = this.#deltaRotation;
		const { context, audioset } = host;
		const { dataFrequency, volume, amplitude, bassLevel, spectralCentroid, djTilt, djBoost, djSpread } = audioset;
		const { width, height } = context.canvas;
		const lineWidth = context.lineWidth;
		const hueSpread = djSpread.lerp(1, 59, 90, 150);
		const hueBias = spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, -40, 40) + djTilt.lerp(-12, 12, -25, 25);
		const normLightness = meanGeometric(volume.lerp(0, 1, 0.2, 0.7), spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, 0.25, 0.75));

		const gradientSpectrum = context.createLinearGradient(-width / 2, height / 2, width / 2, height / 2);
		context.beginPath();
		const position = Vector2D.newNaN;
		const length = trunc(width / max(width, height) * audioset.length);
		for (let offset = 0.5 - length; offset < length; offset++) {
			const index = trunc(abs(offset));
			const normProgress = index.lerp(0, length);
			const normDatumFrequency = dataFrequency[trunc(index * 0.7)];
			const normScale = meanGeometric(normDatumFrequency, normDatumFrequency, volume);
			position.x = width * (normProgress - 0.5);
			position.y = height * ((1 - normScale) * normShadowAnchor - 0.5 + Number(offset < 0) * normScale);
			gradientSpectrum.addColorStop(normProgress, new Color(colorSpectrumSeed)
				.rotate(hueSpread * normProgress + deltaRotation * amplitude.lerp(0, 1, -1, 1) + hueBias)
				.illuminate(normLightness)
				.toString()
			);
			context.lineTo(position.x, position.y);
		}
		context.closePath();
		context.globalCompositeOperation = "source-in";
		context.fillStyle = gradientSpectrum;
		context.shadowOffsetX = 0;
		context.shadowOffsetY = 0;
		context.shadowColor = colorSpectrumSeed.toString();
		context.shadowBlur = bassLevel.clamp(0, 0.6).lerp(0, 0.6, lineWidth * 2, lineWidth * 10) * djBoost.lerp(0.25, 1.75, 0.8, 1.2);
		context.fill();
		context.shadowBlur = 0;
	}

	#driverSpectrum: ColorDriver = ColorDriver.rotation;

	#runSpectrumRotation(host: VisualizationHost): void {
		const { audioset, environment } = host;
		this.#driverSpectrum.tick(this.#colorSpectrumSeed, -this.#deltaRotation, environment.delta, audioset.amplitude);
	}
	//#endregion
	//#region Shadow
	#colorShadow: Color = Color.newBlack;

	#runShadowDrawing(host: VisualizationHost): void {
		const colorShadow = this.#colorShadow;
		const normShadowAnchor = this.#normShadowAnchor;
		const normTopAnchor = normShadowAnchor * 2 / 3;
		const normBottomAnchor = normTopAnchor + 1 / 3;
		const { context } = host;
		const { width, height } = context.canvas;
		const { a, d, e, f } = context.getTransform();

		const gradientShadow = context.createLinearGradient(e, -f, e, f);
		gradientShadow.addColorStop(0, colorShadow.pass(0).toString());
		gradientShadow.addColorStop(normTopAnchor, colorShadow.pass(0.2).toString());
		gradientShadow.addColorStop(normShadowAnchor, colorShadow.pass(0.8).toString());
		gradientShadow.addColorStop(normBottomAnchor, colorShadow.pass(0.4).toString());
		gradientShadow.addColorStop(1, colorShadow.pass(0).toString());
		context.globalCompositeOperation = "multiply";
		context.fillStyle = gradientShadow;
		context.fillRect(-e / a, -f / d, width / a, height / d);
	}
	//#endregion

	update(host: VisualizationHost): void {
		this.#runContextUpdate(host);

		this.#runGridDrawing(host);

		this.#runSpectrumDrawing(host);
		this.#runSpectrumRotation(host);

		this.#runShadowDrawing(host);
	}
});
//#endregion
