"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";

//#region Traffic context
export class TrafficContext extends Model {
	/** GA4's reserved internal-traffic marker. "internal" when the page runs on localhost (the owner's development server), absent otherwise. Never derived from anything a visitor can set, so it cannot be spoofed on the live site. */
	@Field(Optional.Of(String), { name: "traffic_type" })
	type: string | undefined;

	/** Organisation that owns the visitor's network (e.g. "Google LLC", "Amazon.com, Inc.", "Ucom LLC"), from Cloudflare's request.cf.asOrganization, handed over by the site worker in the _net cookie. Cloud and hosting providers mark datacenter bots. Absent when the worker did not run. */
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
