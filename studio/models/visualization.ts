"use strict";

import "adaptive-extender/worker";
import { type Color } from "adaptive-extender/worker";

//#region Audioset
export interface Audioset {
	get length(): number;
	get sampleRate(): number;
	get time(): number;
	get volume(): number;
	get dataFrequency(): ArrayLike<number>;
	get dataTemporal(): ArrayLike<number>;
	get dataDrums(): ArrayLike<number>;
	get dataBass(): ArrayLike<number>;
	get dataVocals(): ArrayLike<number>;
	get dataGuitar(): ArrayLike<number>;
	get dataKeys(): ArrayLike<number>;
	get dataOther(): ArrayLike<number>;
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
//#endregion
//#region Environment
export interface LyricsWindow {
	get previous(): string | null;
	get current(): string | null;
	get next(): string | null;
	get shake(): number;
}

export interface Environment {
	get delta(): number;
	get colorBackground(): Color;
	get lyrics(): LyricsWindow | null;
}
//#endregion
//#region Host
export interface Host {
	get context(): OffscreenCanvasRenderingContext2D;
	get audioset(): Audioset;
	get environment(): Environment;
}
//#endregion
