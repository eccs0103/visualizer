"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Stems
export enum Stem {
	drums,
	bass,
	vocals,
	other,
	guitar,
	keys,
}

export class Stems {
	static #all: readonly Stem[] = Object.freeze([Stem.drums, Stem.bass, Stem.vocals, Stem.other, Stem.guitar, Stem.keys]);

	static get all(): readonly Stem[] { return Stems.#all; }
}
//#endregion
//#region Stem gains
export class StemGains extends Model {
	@Field(Number)
	drums: number;

	@Field(Number)
	bass: number;

	@Field(Number)
	vocals: number;

	@Field(Number)
	guitar: number;

	@Field(Number)
	keys: number;

	@Field(Number)
	other: number;

	constructor();
	constructor(drums: number, bass: number, vocals: number, guitar: number, keys: number, other: number);
	constructor(drums?: number, bass?: number, vocals?: number, guitar?: number, keys?: number, other?: number) {
		if (drums === undefined || bass === undefined || vocals === undefined || guitar === undefined || keys === undefined || other === undefined) {
			super();
			return;
		}

		super();
		this.drums = drums;
		this.bass = bass;
		this.vocals = vocals;
		this.guitar = guitar;
		this.keys = keys;
		this.other = other;
	}

	static get unit(): StemGains { return new StemGains(1, 1, 1, 1, 1, 1); }

	of(stem: Stem): number {
		switch (stem) {
		case Stem.drums: return this.drums;
		case Stem.bass: return this.bass;
		case Stem.vocals: return this.vocals;
		case Stem.guitar: return this.guitar;
		case Stem.keys: return this.keys;
		case Stem.other: return this.other;
		default: throw new TypeError(`Invalid '${stem}' stem`);
		}
	}
}
//#endregion
