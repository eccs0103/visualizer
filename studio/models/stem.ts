"use strict";

import "adaptive-extender/core";

//#region Stems
/** The six instruments the splitter separates. Each value is the stem's column in a row of masks: the order the model's head writes them in. */
export enum Stem {
	drums,
	bass,
	vocals,
	other,
	guitar,
	keys,
}

/** Every stem, in column order. */
export class Stems {
	static #all: readonly Stem[] = Object.freeze([Stem.drums, Stem.bass, Stem.vocals, Stem.other, Stem.guitar, Stem.keys]);

	static get all(): readonly Stem[] { return Stems.#all; }
	static get count(): number { return Stems.#all.length; }
}
//#endregion
