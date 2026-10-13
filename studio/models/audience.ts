"use strict";

import "adaptive-extender/core";

//#region Audience
export enum Audience {
	visitors,
	developers,
	pandocrator,
}

export class Audiences {
	static #parameter: string = "for";

	static from(url: Readonly<URL>): Audience {
		switch (url.searchParams.get(Audiences.#parameter)) {
		case "developers": return Audience.developers;
		case "pandocrator": return Audience.pandocrator;
		default: return Audience.visitors;
		}
	}

	static isDeveloper(audience: Audience): boolean {
		return audience !== Audience.visitors;
	}
}
//#endregion
