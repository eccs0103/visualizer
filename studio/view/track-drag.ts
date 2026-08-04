"use strict";

import "adaptive-extender/web";
import { Reorder } from "../models/playlist.js";

//#region Track drag
export class TrackDrag {
	#row: HTMLLIElement;
	#rows: HTMLLIElement[];
	#height: number;
	#startY: number;
	#from: number;
	#target: number;

	constructor(row: HTMLLIElement, rows: HTMLLIElement[], startY: number) {
		this.#row = row;
		this.#rows = rows;
		this.#from = rows.indexOf(row);
		this.#target = this.#from;
		this.#startY = startY;
		this.#height = TrackDrag.#measure(rows, row);
		row.dataset["dragging"] = String.empty;
	}

	static #measure(rows: readonly HTMLLIElement[], row: HTMLLIElement): number {
		if (rows.length > 1) return rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top;
		return row.getBoundingClientRect().height;
	}

	#applyShift(sibling: HTMLLIElement, offset: number): void {
		sibling.dataset["shifted"] = String.empty;
		sibling.style.setProperty("--drag-offset", `${offset}px`);
	}

	#shiftSiblings(next: number): void {
		const rows = this.#rows;
		const from = this.#from;
		for (const sibling of rows) {
			if (sibling === this.#row) continue;
			delete sibling.dataset["shifted"];
			sibling.style.removeProperty("--drag-offset");
		}
		if (next < from) for (let index = next; index < from; index++) this.#applyShift(rows[index], this.#height);
		else if (next > from) for (let index = from + 1; index <= next; index++) this.#applyShift(rows[index], -this.#height);
		this.#target = next;
	}

	#reset(): void {
		const row = this.#row;
		for (const sibling of this.#rows) {
			delete sibling.dataset["shifted"];
			sibling.style.removeProperty("--drag-offset");
		}
		delete row.dataset["dragging"];
		row.style.removeProperty("--drag-offset");
	}

	track(clientY: number): void {
		const delta = clientY - this.#startY;
		this.#row.style.setProperty("--drag-offset", `${delta}px`);
		const next = Math.round(this.#from + delta / this.#height).clamp(0, this.#rows.length - 1);
		if (next !== this.#target) this.#shiftSiblings(next);
	}

	commit(): Reorder {
		const reorder = new Reorder(this.#from, this.#target);
		this.#reset();
		return reorder;
	}

	cancel(): void {
		this.#reset();
	}
}
//#endregion
