"use strict";

import "adaptive-extender/core";
import { Color, Vector2D } from "adaptive-extender/core";
import { type VisualizationHost } from "../models/visualization.js";
import { Registry, Visualization } from "../services/visualization-registry.js";

const { min, max, split, sin, cos, PI, exp, abs, trunc, sqrt, SQRT1_2, asin, meanGeometric } = Math;

//#region Shaper
class Shaper {
	static #arcsinSaturate: Shaper = new Shaper(x => asin(sqrt(x)) * 2 / PI);
	static #smoothstep: Shaper = new Shaper(x => x * x * (3 - 2 * x));
	static #identity: Shaper = new Shaper(x => x);

	#callback: (x: number) => number;

	constructor(callback: (x: number) => number) {
		this.#callback = callback;
	}

	static get arcsinSaturate(): Shaper { return this.#arcsinSaturate; }
	static get smoothstep(): Shaper { return this.#smoothstep; }
	static get identity(): Shaper { return this.#identity; }

	static sigmoid(steepness: number = 12, center: number = 0.5): Shaper {
		return new Shaper(x => 1 / (1 + exp(-(steepness * (x - center)))));
	}

	static power(n: number): Shaper {
		return new Shaper(x => x ** n);
	}

	apply(value: number): number {
		return this.#callback(value);
	}

	then(next: Shaper): Shaper {
		const callback = this.#callback;
		return new Shaper(x => next.apply(callback(x)));
	}

	blend(other: Shaper, alpha: number = 0.5): Shaper {
		const callback = this.#callback;
		return new Shaper(x => callback(x) * (1 - alpha) + other.apply(x) * alpha);
	}

	mirror(): Shaper {
		const callback = this.#callback;
		return new Shaper(x => callback(1 - x));
	}

	invert(): Shaper {
		const callback = this.#callback;
		return new Shaper(x => 1 - callback(x));
	}

	remap(value: number, min2: number, max2: number): number {
		return this.#callback(value).lerp(0, 1, min2, max2);
	}
}
//#endregion
//#region Color driver
class ColorDriver {
	static #rotation: ColorDriver = new ColorDriver((color, steps) => color.rotate(steps));
	#offset: number = 0;
	#callback: (color: Color, steps: number) => void;

	constructor(callback: (color: Color, steps: number) => void) {
		this.#callback = callback;
	}

	static get rotation(): ColorDriver { return this.#rotation; }

	tick(color: Color, ratePerMs: number, delta: number, factor: number = 1): void {
		if (!Number.isFinite(delta)) return;
		const [integer, fractional] = split(this.#offset + ratePerMs * delta * factor);
		this.#callback(color, integer);
		this.#offset = fractional;
	}
}
//#endregion

//#region Pulsar
Registry.attach("Pulsar", class extends Visualization {
	//#region Rebuild preparation
	#radius: number;
	#colorBackground: Color;

	#runMetadataRebuild({ context, environment }: VisualizationHost): void {
		const { width, height } = context.canvas;

		this.#radius = min(width, height) / 2;
		this.#colorBackground = environment.colorBackground;
	}

	#runContextRebuild({ context }: VisualizationHost): void {
		const { width, height } = context.canvas;
		const radius = this.#radius;

		context.setTransform(1, 0, 0, 1, width / 2, height / 2);
		context.lineWidth = radius >> 8;
	}
	//#endregion

	rebuild(host: VisualizationHost): void {
		this.#runMetadataRebuild(host);
		this.#runContextRebuild(host);
	}

	//#region Update preparation
	#runContextUpdate({ context }: VisualizationHost): void {
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
	#shaperFrequency: Shaper = Shaper.sigmoid().then(Shaper.arcsinSaturate);

	#runHaloDrawing({ context, audioset }: VisualizationHost): void {
		const radius = this.#radius;
		const colorHaloOuter = this.#colorHaloOuter;
		const colorHaloInner = this.#colorHaloInner;
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
				.illuminate(volume.lerp(0, 1, 0.1, 1.0))
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
		context.stroke();
	}

	#driverHalo: ColorDriver = ColorDriver.rotation;

	#runHaloRotation({ audioset, environment }: VisualizationHost): void {
		this.#driverHalo.tick(this.#colorHaloOuter, 360 / 6, environment.delta, audioset.volume);
	}
	//#endregion
	//#region Wave
	#runWaveDrawing({ context, audioset }: VisualizationHost): void {
		const radius = this.#radius;
		const gradientHalo = this.#gradientHalo;
		const { dataTemporal, amplitude } = audioset;
		const { width } = context.canvas;
		const { length } = audioset;

		context.beginPath();
		context.moveTo(-width / 2, 0);
		const position = Vector2D.newNaN;
		for (let index = 0; index < length; index++) {
			const normProgress = index.lerp(0, length);
			const normDatumTemporal = dataTemporal[trunc(normProgress * length)].lerp(0, 1, -1, 1);
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

	#runShadowDrawing({ context }: VisualizationHost): void {
		const radius = this.#radius;
		const colorShadow = this.#colorShadow;

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
	#runBackgroundDrawing({ context }: VisualizationHost): void {
		const colorBackground = this.#colorBackground;
		const { a, d, e, f } = context.getTransform();
		const { width, height } = context.canvas;

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

	#runMetadataRebuild({ environment }: VisualizationHost): void {
		this.#deltaRotation = 360 / 6;

		const colorGrid = this.#colorGrid = environment.colorBackground;
		colorGrid.lightness = (colorGrid.lightness / 100).lerp(0, 1, 0.1, 0.9) * 100;
	}

	#runContextRebuild({ context }: VisualizationHost): void {
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
	#runContextUpdate({ context, audioset }: VisualizationHost): void {
		const { volume, amplitude } = audioset;
		const { width, height } = context.canvas;

		let { a, b, c, d, e, f } = context.getTransform();
		a = volume.lerp(0, 1, 1.0, 1.2);
		d = amplitude.lerp(0, 1, 1.0, 1.4);
		context.setTransform(a, b, c, d, e, f);
		context.clearRect(-e / a, -f / d, width / a, height / d);
	}
	//#endregion
	//#region Grid
	#runGridDrawing({ context }: VisualizationHost): void {
		const colorGrid = this.#colorGrid;
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

	#runSpectrumDrawing({ context, audioset }: VisualizationHost): void {
		const normShadowAnchor = this.#normShadowAnchor;
		const colorSpectrumSeed = this.#colorSpectrumSeed;
		const deltaRotation = this.#deltaRotation;
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
				.rotate(120 * normProgress + deltaRotation * amplitude.lerp(0, 1, -1, 1))
				.illuminate(volume.lerp(0, 1, 0.2, 0.7))
				.toString()
			);
			context.lineTo(position.x, position.y);
		}
		context.closePath();
		context.globalCompositeOperation = "source-in";
		context.fillStyle = gradientSpectrum;
		context.fill();
	}

	#driverSpectrum: ColorDriver = ColorDriver.rotation;

	#runSpectrumRotation({ audioset, environment }: VisualizationHost): void {
		this.#driverSpectrum.tick(this.#colorSpectrumSeed, -this.#deltaRotation, environment.delta, audioset.amplitude);
	}
	//#endregion
	//#region Shadow
	#colorShadow: Color = Color.newBlack;

	#runShadowDrawing({ context }: VisualizationHost): void {
		const normShadowAnchor = this.#normShadowAnchor;
		const normTopAnchor = normShadowAnchor * 2 / 3;
		const normBottomAnchor = normTopAnchor + 1 / 3;
		const colorShadow = this.#colorShadow;
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
