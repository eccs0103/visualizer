"use strict";

import "adaptive-extender/web";

//#region Client bridge
export class ClientBridge {
	async read(path: Readonly<URL>): Promise<string | null> {
		const response = await fetch(path);
		if (response.status === 404) return null;
		if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
		const content = await response.text();
		return content;
	}

	async write(path: Readonly<URL>, content: string): Promise<void> {
		void path, content;
		throw new TypeError("Write operation is restricted in Web context");
	}
}
//#endregion
