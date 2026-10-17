"use strict";

import "adaptive-extender/core";

//#region Splitter status
export abstract class SplitterStatus {
	constructor() {
		if (new.target === SplitterStatus) throw new TypeError("Unable to create an instance of an abstract class");
	}

	abstract get summary(): string;
}

export class LoadingStatus extends SplitterStatus {
	get summary(): string { return "Loading…"; }
}

export class OffStatus extends SplitterStatus {
	get summary(): string { return "Off"; }
}

export class ActiveStatus extends SplitterStatus {
	#device: string | null;
	#rate: number | null;
	#milliseconds: number | null;
	#slowed: boolean;

	constructor(device: string | null, rate: number | null, milliseconds: number | null, slowed: boolean) {
		super();
		this.#device = device;
		this.#rate = rate;
		this.#milliseconds = milliseconds;
		this.#slowed = slowed;
	}

	get device(): string | null { return this.#device; }
	get rate(): number | null { return this.#rate; }
	get milliseconds(): number | null { return this.#milliseconds; }
	get slowed(): boolean { return this.#slowed; }

	get summary(): string {
		const device = this.#device, rate = this.#rate;
		const parts = ["Active"];
		if (device !== null) parts.push(device);
		if (rate !== null) parts.push(`${rate} updates/s`);
		return parts.join("\n");
	}
}

export class UnavailableStatus extends SplitterStatus {
	#reason: string;

	constructor(reason: string) {
		super();
		this.#reason = reason;
	}

	get reason(): string { return this.#reason; }

	get summary(): string { return `Unavailable\n${this.#reason}`; }
}
//#endregion
