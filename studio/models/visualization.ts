"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";
import { type Scene } from "./audio-features.js";

//#region Audioset view
export interface AudiosetView {
	get length(): number;
	get volume(): number;
	get amplitude(): number;
	get dataFrequency(): Float32Array;
	get dataTemporal(): Float32Array;
	get spectralFlux(): number;
	get subBass(): number;
	get bass(): number;
	get lowMid(): number;
	get mid(): number;
	get highMid(): number;
	get high(): number;
	get zeroCrossingRate(): number;
	get spectralCentroid(): number;
	get percussiveness(): number;
	get beatDetected(): boolean;
	get scene(): Scene;
	get confidence(): number;
	get probabilities(): ReadonlyMap<Scene, number>;
	get dropIntensity(): number;
	get bassLevel(): number;
	get distortionLevel(): number;
	get dspScene(): number;
	isActive(): boolean;
	isPercussive(): boolean;
}
//#endregion
//#region Visualization environment
export interface VisualizationEnvironment {
	get isLaunched(): boolean;
	get delta(): number;
	get fps(): number;
	get colorBackground(): Color;
}
//#endregion
//#region Visualization host
export interface VisualizationHost {
	context: OffscreenCanvasRenderingContext2D;
	audioset: AudiosetView;
	environment: VisualizationEnvironment;
}
//#endregion
//#region Visualization
export interface VisualizationBundle extends VisualizationHost {
	get context(): OffscreenCanvasRenderingContext2D;
	get audioset(): AudiosetView;
	get environment(): VisualizationEnvironment;
	rebuild(): void;
	update(): void;
}

export interface VisualizationDescriptor {
	new(host: VisualizationHost): VisualizationBundle;
}
//#endregion
