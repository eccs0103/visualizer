"use strict";

import "adaptive-extender/core";
import { Color, Random, Vector2D } from "adaptive-extender/core";
import { type StageHost, type VisualizationHost } from "../../models/visualization.js";
import { Registry, Visualization } from "../../services/visualization-registry.js";
import { ColorDriver, Shaper } from "../../services/visualization-tools.js";

const { min, sin, cos, PI, abs, trunc, SQRT1_2, meanGeometric } = Math;
const random = Random.global;
const stopCount = 96;

//#region Pulsar
Registry.attach("Pulsar", class extends Visualization {
	#layerHalo = this.newCustomLayer("Halo", this.#drawHalo.bind(this));
	#layerWave = this.newCustomLayer("Wave", this.#drawWave.bind(this));
	#layerShadow = this.newCustomLayer("Shadow", this.#drawShadow.bind(this));
	#radius: number;
	#colorHaloOuter: Color = Color.fromHSL(0, 100, 60);
	#colorHaloInner: Color;
	#stopsHalo: string[] = [];
	#gradientHalo: CanvasGradient | null = null;
	#pathHalo: Path2D = new Path2D();
	#pathWave: Path2D = new Path2D();
	#shaperFrequency: Shaper = Shaper.sigmoid().then(Shaper.arcsinSaturate);
	#driverHalo: ColorDriver = ColorDriver.rotation;
	#colorShadow: Color;

	//#region Rebuild
	rebuild(stage: StageHost): void {
		const { width, height, environment } = stage;
		const { hue, saturation, lightness } = environment.colorBackground;

		this.#radius = min(width, height) / 2;
		this.#colorHaloInner = Color.fromHSL(hue, saturation, lightness.snap(100));
		this.#colorShadow = Color.fromHSL(hue, saturation, lightness.snap(100));
	}
	//#endregion
	//#region Update
	#runCameraUpdate(stage: StageHost): void {
		const radius = this.#radius;
		const { camera, audioset } = stage;
		const { dropIntensity, djPunch } = audioset;

		const shake = dropIntensity.clamp(0, 0.5).lerp(0, 0.5, 0, radius >> 6) * (1 + djPunch);
		camera.translateSelf(random.number(-1, 1) * shake, random.number(-1, 1) * shake);
	}

	#runHaloRotation(stage: StageHost): void {
		const driverHalo = this.#driverHalo;
		const colorHaloOuter = this.#colorHaloOuter;
		const { audioset, environment } = stage;

		driverHalo.tick(colorHaloOuter, 360 / 6, environment.delta, audioset.volume);
	}

	#runHaloBuilding(stage: StageHost): void {
		const radius = this.#radius;
		const colorHaloOuter = this.#colorHaloOuter;
		const shaperFrequency = this.#shaperFrequency;
		const stops = this.#stopsHalo;
		const { audioset } = stage;
		const { dataFrequency, volume, bassLevel, spectralCentroid, djTilt, length } = audioset;
		const semiLength = length / 2;
		const hueBias = spectralCentroid.clamp(0, 0.45).lerp(0, 0.45, -30, 30) + djTilt.lerp(-12, 12, -20, 20);
		const normIllumination = meanGeometric(volume.lerp(0, 1, 0.1, 1.0), bassLevel.clamp(0, 0.6).lerp(0, 0.6, 0.5, 1.0));

		this.#gradientHalo = null;
		stops.length = 0;
		for (let index = 0; index < stopCount; index++) {
			const normEdge = abs(index.lerp(0, stopCount) - 0.5) * 2;
			stops.push(new Color(colorHaloOuter)
				.rotate(180 * normEdge + hueBias)
				.illuminate(normIllumination)
				.toString());
		}

		const path = this.#pathHalo = new Path2D();
		const position = Vector2D.newNaN;
		for (let index = 0; index < length; index++) {
			const normProgress = index.lerp(0, length);
			const normOffset = abs(index - semiLength).lerp(0, semiLength + 1);
			const normScale = shaperFrequency.apply(dataFrequency[trunc(normOffset * semiLength)]);
			const distance = normScale.lerp(0, 1, 0.6, 1.0) * radius;
			position.x = distance * sin(normProgress * 2 * PI);
			position.y = distance * cos(normProgress * 2 * PI);
			path.lineTo(position.x, position.y);
		}
		path.closePath();
	}

	#runWaveBuilding(stage: StageHost): void {
		const radius = this.#radius;
		const { width, audioset } = stage;
		const { dataTemporal, amplitude, percussiveness, length } = audioset;
		const scalePercussive = percussiveness.lerp(0, 1, 1.0, 1.15);

		const path = this.#pathWave = new Path2D();
		path.moveTo(-width / 2, 0);
		const position = Vector2D.newNaN;
		for (let index = 0; index < length; index++) {
			const normProgress = index.lerp(0, length);
			const normDatumTemporal = dataTemporal[trunc(normProgress * length)].lerp(0, 1, -1, 1);
			const normScale = normDatumTemporal * amplitude * scalePercussive;
			position.x = width * (normProgress - 0.5);
			position.y = radius * normScale;
			path.lineTo(position.x, position.y);
		}
		path.lineTo(width / 2, 0);
	}

	update(stage: StageHost): void {
		this.#runHaloRotation(stage);
		this.#runCameraUpdate(stage);
		this.#runHaloBuilding(stage);
		this.#runWaveBuilding(stage);
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

	#drawHalo(host: VisualizationHost): void {
		const radius = this.#radius;
		const colorHaloInner = this.#colorHaloInner;
		const pathHalo = this.#pathHalo;
		const { context, audioset } = host;
		const { bassLevel, djBoost } = audioset;

		context.lineWidth = radius >> 7;
		context.fillStyle = colorHaloInner.toString();
		context.fill(pathHalo);
		context.strokeStyle = this.#obtainGradientHalo(context);
		const blurHalo = trunc(bassLevel.clamp(0, 0.6).lerp(0, 0.6, radius >> 6, radius >> 3) * djBoost.lerp(0.25, 1.75, 0.8, 1.2) / 2);
		if (blurHalo >= 1) {
			context.filter = `blur(${blurHalo}px)`;
			context.stroke(pathHalo);
			context.filter = "none";
		}
		context.stroke(pathHalo);
	}

	#drawWave(host: VisualizationHost): void {
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

	#drawShadow(host: VisualizationHost): void {
		const radius = this.#radius;
		const colorShadow = this.#colorShadow;
		const { context } = host;

		const gradientShadow = context.createRadialGradient(0, 0, 0, 0, 0, radius);
		gradientShadow.addColorStop(0, colorShadow.pass(1).toString());
		gradientShadow.addColorStop(0.5, colorShadow.pass(SQRT1_2).toString());
		gradientShadow.addColorStop(1, colorShadow.pass(0).toString());
		context.fillStyle = gradientShadow;
		context.fill(this.#pathWave);
	}
	//#endregion
});
//#endregion
