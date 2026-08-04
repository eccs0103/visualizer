"use strict";

import "adaptive-extender/web";

//#region File drop
export interface FileDropEventMap {
	"files": CustomEvent<FileList>;
}

export class FileDrop extends EventTarget {
	constructor(target: HTMLElement) {
		super();

		target.addEventListener("dragover", this.#onDragOver.bind(this));
		target.addEventListener("drop", this.#onDrop.bind(this));
	}

	addEventListener<K extends keyof FileDropEventMap>(type: K, listener: (this: FileDrop, event: FileDropEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof FileDropEventMap>(type: K, listener: (this: FileDrop, event: FileDropEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		return super.removeEventListener(type, listener, options);
	}

	#onDragOver(event: DragEvent): void {
		const { dataTransfer } = event;
		if (dataTransfer === null) return;
		const { files } = dataTransfer;
		if (files.length < 1) return;
		event.preventDefault();
	}

	#onDrop(event: DragEvent): void {
		const { dataTransfer } = event;
		if (dataTransfer === null) return;
		const { files } = dataTransfer;
		if (files.length < 1) return;
		event.preventDefault();
		this.dispatchEvent(new CustomEvent("files", { detail: files }));
	}
}
//#endregion
