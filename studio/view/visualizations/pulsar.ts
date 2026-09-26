"use strict";

import "adaptive-extender/core";
import { Color, Random, Vector2D } from "adaptive-extender/core";
import { Blend } from "../../models/blend.js";
import { type StageHost, type VisualizationHost } from "../../models/visualization.js";
import { Registry, Visualization } from "../../services/visualization-registry.js";
import { ColorDriver, Shaper, Stem, Stems } from "../../services/visualization-tools.js";

const { min, sin, cos, PI, abs, trunc, SQRT1_2, meanGeometric } = Math;
const random = Random.global;

//#region Pulsar
Registry.attach("Pulsar", class extends Visualization {
	#layerHalo = this.newCustomLayer("Halo", this.#drawHalo.bind(this));
	#layerOther = this.newCustomLayer("Other", host => this.#drawStem(host, Stem.Other), { opacity: 0, blend: Blend.lighter });
	#layerVocals = this.newCustomLayer("Vocals", host => this.#drawStem(host, Stem.Vocals), { opacity: 0, blend: Blend.lighter });
	#layerBass = this.newCustomLayer("Bass", host => this.#drawStem(host, Stem.Bass), { opacity: 0, blend: Blend.lighter });
	#layerDrums = this.newCustomLayer("Drums", host => this.#drawStem(host, Stem.Drums), { opacity: 0, blend: Blend.lighter });
	#layerWave = this.newCustomLayer("Wave", this.#drawWave.bind(this));
	#layerShadow = this.newCustomLayer("Shadow", this.#drawShadow.bind(this));
	#countStops: number = 96;
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
	#gainStem: number = 2; // a stem is only a share of the mix, so it needs some gain to clear the shaper's knee, which is tuned for the full mix
	#palette: Color[] = [];
	#levelVocals: number = 0;
	#reaches: Float32Array[] = [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)];
	#indices: Int32Array = new Int32Array(0);
	#sine: Float32Array = new Float32Array(0);
	#cosine: Float32Array = new Float32Array(0);

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
		const countStops = this.#countStops;
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
		for (let index = 0; index < countStops; index++) {
			const normEdge = abs(index.lerp(0, countStops) - 0.5) * 2;
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

		this.#palette = Stems.palette(colorHaloOuter, hueBias, normIllumination);
		this.#levelVocals = Stems.level(audioset.dataFrequencyVocals);
		this.#runStemBuilding(stage);
	}

	#resizeStems(length: number): void {
		if (this.#indices.length === length) return;
		const semiLength = length / 2;
		this.#reaches = this.#reaches.map(() => new Float32Array(length));
		this.#indices = new Int32Array(length);
		this.#sine = new Float32Array(length);
		this.#cosine = new Float32Array(length);
		for (let index = 0; index < length; index++) {
			const angle = index.lerp(0, length) * 2 * PI;
			this.#indices[index] = trunc(abs(index - semiLength).lerp(0, semiLength + 1) * semiLength);
			this.#sine[index] = sin(angle);
			this.#cosine[index] = cos(angle);
		}
	}

	/** Each stem gets its own silhouette from its own isolated spectrum, on the same scale as the halo, so a stem that is absent collapses toward the floor ring instead of riding the mix. */
	#runStemBuilding(stage: StageHost): void {
		const radius = this.#radius;
		const gainStem = this.#gainStem;
		const shaperFrequency = this.#shaperFrequency;
		const { audioset } = stage;
		const { length } = audioset;

		this.#resizeStems(length);
		const indices = this.#indices;
		const spectra = Stems.spectra(audioset);
		const reaches = this.#reaches;
		for (let stem = 0; stem < reaches.length; stem++) {
			const spectrum = spectra[stem], reach = reaches[stem];
			for (let index = 0; index < length; index++) reach[index] = shaperFrequency.apply(min(1, spectrum[indices[index]] * gainStem)).lerp(0, 1, 0.6, 1.0) * radius;
		}
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
		this.#drawVoice(context);
		context.strokeStyle = this.#obtainGradientHalo(context);
		const blurHalo = trunc(bassLevel.clamp(0, 0.6).lerp(0, 0.6, radius >> 6, radius >> 3) * djBoost.lerp(0.25, 1.75, 0.8, 1.2) / 2);
		if (blurHalo >= 1) {
			context.filter = `blur(${blurHalo}px)`;
			context.stroke(pathHalo);
			context.filter = "none";
		}
		context.stroke(pathHalo);
	}

	/** The inner rim of the halo lights up in the vocals colour while someone sings — vocals are the one stem the mix alone cannot tell apart. */
	#drawVoice(context: OffscreenCanvasRenderingContext2D): void {
		const radius = this.#radius;
		const alpha = this.#levelVocals.clamp(0, 0.06).lerp(0, 0.06, 0, 0.6);
		if (alpha <= 0) return;
		const colorVocals = this.#palette[Stem.Vocals];
		const gradientVoice = context.createRadialGradient(0, 0, radius * 0.3, 0, 0, radius * 0.6);
		gradientVoice.addColorStop(0, new Color(colorVocals).pass(0).toString());
		gradientVoice.addColorStop(1, new Color(colorVocals).pass(alpha).toString());
		context.fillStyle = gradientVoice;
		context.fill(this.#pathHalo);
	}

	#drawStem(host: VisualizationHost, stem: Stem): void {
		const floor = this.#radius * 0.6;
		const reach = this.#reaches[stem], sine = this.#sine, cosine = this.#cosine;
		const { context } = host;
		const size = reach.length;

		context.beginPath();
		for (let point = 0; point < size; point++) {
			if (point === 0) context.moveTo(reach[point] * sine[point], reach[point] * cosine[point]);
			else context.lineTo(reach[point] * sine[point], reach[point] * cosine[point]);
		}
		for (let point = size - 1; point >= 0; point--) context.lineTo(floor * sine[point], floor * cosine[point]);
		context.closePath();
		context.fillStyle = this.#palette[stem].toString();
		context.fill();
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
