"use strict";

import "adaptive-extender/web";
import { Reorder } from "../models/reorder.js";
import { ArrowKeys } from "./arrow-keys.js";

//#region Drag gesture
class DragGesture {
	#row: HTMLLIElement;
	#rows: HTMLLIElement[];
	#height: number;
	#yStart: number;
	#from: number;
	#target: number;

	constructor(row: HTMLLIElement, rows: HTMLLIElement[], yStart: number) {
		this.#row = row;
		this.#rows = rows;
		this.#from = rows.indexOf(row);
		this.#target = this.#from;
		this.#yStart = yStart;
		this.#height = DragGesture.#measure(rows, row);
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
		const height = this.#height;
		for (const sibling of rows) {
			if (sibling === this.#row) continue;
			delete sibling.dataset["shifted"];
			sibling.style.removeProperty("--drag-offset");
		}
		if (next < from) for (let index = next; index < from; index++) this.#applyShift(rows[index], height);
		else if (next > from) for (let index = from + 1; index <= next; index++) this.#applyShift(rows[index], -height);
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
		const delta = clientY - this.#yStart;
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
//#region Row drag
export interface RowDragEventMap {
	"reorder": CustomEvent<Reorder>;
}

export class RowDrag extends EventTarget {
	#list: HTMLOListElement;
	#selector: string;
	#gesture: DragGesture | null = null;

	constructor(list: HTMLOListElement, selector: string) {
		super();
		this.#list = list;
		this.#selector = selector;
		list.addEventListener("pointerdown", this.#onPointerDown.bind(this));
		list.addEventListener("pointermove", this.#onPointerMove.bind(this));
		list.addEventListener("pointerup", this.#onPointerUp.bind(this));
		list.addEventListener("pointercancel", this.#onPointerCancel.bind(this));
		list.addEventListener("keydown", this.#onKeyDown.bind(this));
	}

	addEventListener<K extends keyof RowDragEventMap>(type: K, listener: (this: RowDrag, event: RowDragEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof RowDragEventMap>(type: K, listener: (this: RowDrag, event: RowDragEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		return super.removeEventListener(type, listener, options);
	}

	get rows(): HTMLLIElement[] {
		return Array.from(this.#list.getElements(HTMLLIElement, this.#selector));
	}

	#findRow(event: Event): HTMLLIElement | undefined {
		return event.composedPath().find(node => node instanceof HTMLLIElement);
	}

	#findHandle(event: Event): HTMLElement | undefined {
		return event.composedPath().find((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains("handle"));
	}

	#onPointerDown(event: PointerEvent): void {
		const handle = this.#findHandle(event);
		if (handle === undefined) return;
		const row = this.#findRow(event);
		if (row === undefined) return;
		event.stopPropagation();
		handle.setPointerCapture(event.pointerId);
		this.#gesture = new DragGesture(row, this.rows, event.clientY);
	}

	#onPointerMove(event: PointerEvent): void {
		const gesture = this.#gesture;
		if (gesture === null) return;
		gesture.track(event.clientY);
	}

	#onPointerUp(event: PointerEvent): void {
		const gesture = this.#gesture;
		if (gesture === null) return;
		const reorder = gesture.commit();
		this.#gesture = null;
		if (!reorder.isEffective) return;
		this.dispatchEvent(new CustomEvent("reorder", { detail: reorder }));
	}

	#onPointerCancel(event: PointerEvent): void {
		const gesture = this.#gesture;
		if (gesture === null) return;
		gesture.cancel();
		this.#gesture = null;
	}

	#onKeyDown(event: KeyboardEvent): void {
		const step = ArrowKeys.vertical(event.code);
		if (step === 0) return;
		if (this.#findHandle(event) === undefined) return;
		const row = this.#findRow(event);
		if (row === undefined) return;
		const { rows } = this;
		const from = rows.indexOf(row);
		if (from < 0) return;
		const to = (from + step).clamp(0, rows.length - 1);
		event.preventDefault();
		const reorder = new Reorder(from, to);
		if (!reorder.isEffective) return;
		this.dispatchEvent(new CustomEvent("reorder", { detail: reorder }));
	}
}
//#endregion
