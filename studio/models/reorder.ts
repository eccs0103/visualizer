"use strict";

import "adaptive-extender/core";

//#region Reorder
export class Reorder {
	from: number;
	to: number;

	constructor(from: number, to: number) {
		this.from = from;
		this.to = to;
	}

	get isEffective(): boolean {
		return this.from !== this.to;
	}

	apply<T>(items: T[]): boolean {
		const { from, to } = this;
		if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return false;
		const [item] = items.splice(from, 1);
		items.splice(to, 0, item);
		return true;
	}
}
//#endregion
