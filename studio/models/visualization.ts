"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";
import { type Layer } from "../services/layers.js";

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
	get dropIntensity(): number;
	get bassLevel(): number;
	get distortionLevel(): number;
	get djFocus(): number;
	get djSpread(): number;
	get djBoost(): number;
	get djTilt(): number;
	get djPunch(): number;
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
	get lyrics(): LyricsView | null;
}
//#endregion
//#region Lyrics view
export interface LyricsView {
	get previous(): string | null;
	get current(): string | null;
	get next(): string | null;
	get shake(): number;
}

export class LyricsWindow implements LyricsView {
	previous: string | null;
	current: string | null;
	next: string | null;
	shake: number;

	constructor(previous: string | null, current: string | null, next: string | null, shake: number) {
		this.previous = previous;
		this.current = current;
		this.next = next;
		this.shake = shake;
	}
}
//#endregion
//#region Visualization host
export interface VisualizationHost {
	get context(): OffscreenCanvasRenderingContext2D;
	get audioset(): AudiosetView;
	get environment(): VisualizationEnvironment;
}
//#endregion
//#region Stage host
export interface StageHost {
	get width(): number;
	get height(): number;
	get camera(): DOMMatrix;
	get audioset(): AudiosetView;
	get environment(): VisualizationEnvironment;
}
//#endregion
//#region Visualization
export interface VisualizationBundle {
	layers(): Layer[];
	rebuild(stage: StageHost): void;
	update(stage: StageHost): void;
}

export interface VisualizationDescriptor {
	new(): VisualizationBundle;
}
//#endregion
