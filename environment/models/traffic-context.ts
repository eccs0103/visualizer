"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region Traffic context
export interface TrafficContextScheme {
	traffic_type: string | undefined;
	network: string | undefined;
}

export class TrafficContext extends Model {
	/** Never derived from anything a visitor can set, so it cannot be spoofed on the live site. */
	@Field(Optional.Of(String), { name: "traffic_type" })
	type: string | undefined;

	/** Set by the site worker in the _net cookie; absent when the worker did not run. */
	@Field(Optional.Of(String), { name: "network" })
	network: string | undefined;

	constructor();
	constructor(type: string | undefined, network: string | undefined);
	constructor(type?: string, network?: string) {
		super();
		this.type = type;
		this.network = network;
	}
}
//#endregion
