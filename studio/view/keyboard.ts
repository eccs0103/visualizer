"use strict";

import "adaptive-extender/web";

//#region Keyboard
export class Keyboard {
	static get typing(): boolean {
		const { activeElement } = document;
		return activeElement instanceof HTMLInputElement || activeElement instanceof HTMLSelectElement || activeElement instanceof HTMLTextAreaElement;
	}

	static vertical(code: string): number {
		switch (code) {
		case "ArrowUp": return -1;
		case "ArrowDown": return 1;
		default: return 0;
		}
	}

	static horizontal(code: string): number {
		switch (code) {
		case "ArrowLeft": return -1;
		case "ArrowRight": return 1;
		default: return 0;
		}
	}

	static cycle(select: HTMLSelectElement, step: number): void {
		select.selectedIndex = (select.selectedIndex + step).mod(select.length);
		select.dispatchEvent(new Event("change"));
	}
}
//#endregion
