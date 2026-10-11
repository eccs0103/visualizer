"use strict";

import "adaptive-extender/core";

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
	static get count(): number { return Stems.#all.length; }
}
//#endregion
