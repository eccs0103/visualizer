"use strict";

import "adaptive-extender/core";
import { type Color } from "adaptive-extender/core";
import { type Layer, type LayerOptions, type LayerPainter } from "../services/layers.js";

//#region Spectrum view
export interface SpectrumView {
	get dataFrequency(): Float32Array;
	get energy(): number;
	get spectralFlux(): number;
	get subBass(): number;
	get bass(): number;
	get lowMid(): number;
	get mid(): number;
	get highMid(): number;
	get high(): number;
	get spectralCentroid(): number;
	get percussiveness(): number;
	get beatDetected(): boolean;
	get dropIntensity(): number;
	get bassLevel(): number;
}

export interface StemsView {
	get drums(): SpectrumView;
	get bass(): SpectrumView;
	get vocals(): SpectrumView;
	get other(): SpectrumView;
}
//#endregion
//#region Audioset view
export interface AudiosetView extends SpectrumView {
	get length(): number;
	get dataTemporal(): Float32Array;
	get volume(): number;
	get stems(): StemsView;
}
//#endregion
//#region Visualization environment
export interface VisualizationEnvironment {
	get delta(): number;
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
	get layers(): readonly Layer[];
	newLayer(name: string, painter: LayerPainter, options?: Partial<LayerOptions>): Layer;
	rebuild(stage: StageHost): void;
	update(stage: StageHost): void;
}

export interface VisualizationDescriptor {
	new(): VisualizationBundle;
}
//#endregion
