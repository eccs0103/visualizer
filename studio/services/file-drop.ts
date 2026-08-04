"use strict";

import "adaptive-extender/web";

//#region File drop
export interface FileDropEventMap {
	"files": CustomEvent<FileList>;
}

export class FileDrop extends EventTarget {
	constructor(target: HTMLElement) {
		super();
		this.#wire(target);
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

	#wire(target: HTMLElement): void {
		target.addEventListener("dragover", (event) => {
			const { dataTransfer } = event;
			if (dataTransfer === null) return;
			if (!Array.from(dataTransfer.items).some(item => item.kind === "file")) return;
			event.preventDefault();
		});
		target.addEventListener("drop", (event) => {
			const { dataTransfer } = event;
			if (dataTransfer === null) return;
			const { files } = dataTransfer;
			if (files.length < 1) return;
			event.preventDefault();
			this.dispatchEvent(new CustomEvent("files", { detail: files }));
		});
	}
}
//#endregion
