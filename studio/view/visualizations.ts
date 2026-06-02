"use strict";

import "adaptive-extender/core";
import { Color, Vector2D } from "adaptive-extender/core";
import { Visualization, VisualizationRegistry } from "../services/visualization-registry.js";

const { min, max, split, sin, cos, PI, exp, abs, trunc, sqrt, SQRT1_2, asin, meanGeometric } = Math;

//#region Pulsar
VisualizationRegistry.attach("Pulsar", class extends Visualization {
	//#region Rebuild preparation
	#radius: number;
	#colorBackground: Color;

	#runMetadataRebuild(): void {
		const { context } = this;
		const { width, height } = context.canvas;

		const radius = this.#radius = min(width, height) / 2;

		const colorBackground = this.#colorBackground = this.environment.colorBackground;
	}

	#runContextRebuild(): void {
		const { context } = this;
		const { width, height } = context.canvas;
		const radius = this.#radius;

		context.setTransform(1, 0, 0, 1, width / 2, height / 2);

		context.lineWidth = radius / 256;
	}
	//#endregion

	rebuild(): void {
		this.#runMetadataRebuild();
		this.#runContextRebuild();
	}

	//#region Update preparation
	#runContextUpdate(): void {
		const { context } = this;
		const { width, height } = context.canvas;

		let { a, b, c, d, e, f } = context.getTransform();
		/** @todo Any actions? */
		context.setTransform(a, b, c, d, e, f);
		context.clearRect(-e / a, -f / d, width / a, height / d);
	}
	//#endregion
	//#region Halo
	#colorHaloOuter: Color = Color.fromHSL(0, 100, 50);
	#colorHaloInner: Color = Color.newBlack;
	#gradientHalo: CanvasGradient;

	#runHaloDrawing(): void {
		const radius = this.#radius;
		const colorHaloOuter = this.#colorHaloOuter;
		const colorHaloInner = this.#colorHaloInner;
		const { context, audioset } = this;
		const { dataFrequency, volume } = audioset;
		const { length } = audioset;
		const semiLength = length / 2;

		const gradientHalo = this.#gradientHalo = context.createConicGradient(PI / 2, 0, 0);
		context.beginPath();
		const position = Vector2D.newNaN;
		for (let index = 0; index < length; index++) {
			const normProgress = index.lerp(0, length);
			const normOffset = abs(index - semiLength).lerp(0, semiLength + 1);
			gradientHalo.addColorStop(normProgress, new Color(colorHaloOuter)
				.rotate(180 * normOffset)
				.illuminate(0.1 + 0.9 * volume)
				.toString()
			);
			const normDatumFrequency = dataFrequency[trunc(normOffset * semiLength)];
			let normScale = normDatumFrequency;
			normScale = 1 / (1 + exp(-((normScale - 0.5) * 12))); /** @todo smoothSigmoid */
			normScale = asin(sqrt(normScale)) * 2 / PI; /** @todo saturateArcsin */
			const distance = (0.6 + 0.4 * normScale) * radius;
			position.x = distance * sin(normProgress * 2 * PI);
			position.y = distance * cos(normProgress * 2 * PI);
			context.lineTo(position.x, position.y);
		}
		context.closePath();
		context.globalCompositeOperation = "source-over";
		context.fillStyle = colorHaloInner.toString();
		context.fill();
		context.strokeStyle = gradientHalo;
		context.stroke();
	}

	#offsetHaloRotation: number = 0;

	#runHaloRotation(): void {
		const colorHalo = this.#colorHaloOuter;
		const duration = 6;
		const { audioset, environment } = this;
		const { delta } = environment;
		const { volume } = audioset;

		if (!Number.isFinite(delta)) return;
		const [integer, fractional] = split(this.#offsetHaloRotation + (360 / duration) * delta * volume);
		colorHalo.rotate(integer);
		this.#offsetHaloRotation = fractional;
	}
	//#endregion
	//#region Wave
	#runWaveDrawing(): void {
		const radius = this.#radius;
		const gradientHalo = this.#gradientHalo;
		const { context, audioset } = this;
		const { dataTemporal, amplitude } = audioset;
		const { width } = context.canvas;
		const { length } = audioset;

		context.beginPath();
		context.moveTo(-width / 2, 0);
		const position = Vector2D.newNaN;
		for (let index = 0; index < length; index++) {
			const normProgress = index.lerp(0, length);
			const normDatumTemporal = dataTemporal[trunc(normProgress * length)] * 2 - 1;
			const normScale = normDatumTemporal * amplitude;
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

	#runShadowDrawing(): void {
		const radius = this.#radius;
		const colorShadow = this.#colorShadow;
		const { context } = this;

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
	#runBackgroundDrawing(): void {
		const colorBackground = this.#colorBackground;
		const { context } = this;
		const { a, d, e, f } = context.getTransform();
		const { width, height } = context.canvas;

		context.globalCompositeOperation = "destination-atop";
		context.fillStyle = colorBackground.toString();
		context.fillRect(-e / a, -f / d, width / a, height / d);
	}
	//#endregion

	update(): void {
		this.#runContextUpdate();

		this.#runHaloDrawing();
		this.#runHaloRotation();

		this.#runWaveDrawing();

		this.#runShadowDrawing();

		this.#runBackgroundDrawing();
	}
});
//#endregion
//#region Spectrogram
VisualizationRegistry.attach("Spectrogram", class extends Visualization {
	//#region Rebuild preparation
	#normShadowAnchor: number = 0.8;
	#deltaRotation: number;
	#colorGrid: Color;

	#interpolate(value: number): number {
		const alpha = 0.2;
		return value * (1 - alpha) + 0.5 * alpha;
	}

	#runMetadataRebuild(): void {
		this.#deltaRotation = 360 / 6;

		const colorGrid = this.#colorGrid = this.environment.colorBackground;
		colorGrid.lightness = this.#interpolate(colorGrid.lightness / 100) * 100;
	}

	#runContextRebuild(): void {
		const { context } = this;
		const { width, height } = context.canvas;

		context.setTransform(1, 0, 0, 1, width / 2, height / 2);

		context.lineWidth = min(width, height) >> 8;
	}
	//#endregion

	rebuild(): void {
		this.#runMetadataRebuild();
		this.#runContextRebuild();
	}

	//#region Update preparation
	#runContextUpdate(): void {
		const { audioset, context } = this;
		const { volume, amplitude } = audioset;
		const { width, height } = context.canvas;

		let { a, b, c, d, e, f } = context.getTransform();
		a = 1 + 0.2 * volume;
		d = 1 + 0.4 * amplitude;
		context.setTransform(a, b, c, d, e, f);
		context.clearRect(-e / a, -f / d, width / a, height / d);
	}
	//#endregion
	//#region Grid
	#runGridDrawing(): void {
		const colorGrid = this.#colorGrid;
		const { context } = this;
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

	#runSpectrumDrawing(): void {
		const normShadowAnchor = this.#normShadowAnchor;
		const colorSpectrumSeed = this.#colorSpectrumSeed;
		const deltaRotation = this.#deltaRotation;
		const { context, audioset } = this;
		const { dataFrequency, volume, amplitude } = audioset;
		const { width, height } = context.canvas;

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
				.rotate(120 * normProgress + deltaRotation * (amplitude * 2 - 1))
				.illuminate(0.2 + 0.5 * volume)
				.toString()
			);
			context.lineTo(position.x, position.y);
		}
		context.closePath();
		context.globalCompositeOperation = "source-in";
		context.fillStyle = gradientSpectrum;
		context.fill();
	}

	#offsetSpectrumRotation: number = 0;

	#runSpectrumRotation(): void {
		const colorSpectrumSeed = this.#colorSpectrumSeed;
		const deltaRotation = this.#deltaRotation;
		const { audioset, environment } = this;
		const { delta } = environment;
		const { amplitude } = audioset;

		if (!Number.isFinite(delta)) return;
		const [integer, fractional] = split(this.#offsetSpectrumRotation + deltaRotation * delta * amplitude);
		colorSpectrumSeed.rotate(-integer);
		this.#offsetSpectrumRotation = fractional;
	}
	//#endregion
	//#region Shadow
	#colorShadow: Color = Color.newBlack;

	#runShadowDrawing(): void {
		const normShadowAnchor = this.#normShadowAnchor;
		const normTopAnchor = normShadowAnchor * 2 / 3;
		const normBottomAnchor = normTopAnchor + 1 / 3;
		const colorShadow = this.#colorShadow;
		const { context } = this;
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

	update(): void {
		this.#runContextUpdate();

		this.#runGridDrawing();

		this.#runSpectrumDrawing();
		this.#runSpectrumRotation();

		this.#runShadowDrawing();
	}
});
//#endregion
