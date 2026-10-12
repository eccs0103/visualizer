"use strict";

import "adaptive-extender/web";

//#region Arrow keys
export class ArrowKeys {
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
}
//#endregion
