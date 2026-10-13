"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";
import { BlobPortable } from "./portables.js";

//#region Row
export abstract class Row extends Model {
	@Field(String, { name: "id" })
	id: string;

	constructor();
	constructor(id: string);
	constructor(id?: string) {
		super();
		if (new.target === Row) throw new TypeError("Unable to create an instance of an abstract class");
		if (id === undefined) return;
		this.id = id;
	}

	static orphans(rows: Iterable<Row>, ids: ReadonlySet<string>): string[] {
		const orphans: string[] = [];
		for (const { id } of rows) {
			if (ids.has(id)) continue;
			orphans.push(id);
		}
		return orphans;
	}
}
//#endregion
//#region File row
export class FileRow extends Row {
	@Field(BlobPortable, { name: "file" })
	file: Blob;

	constructor();
	constructor(id: string, file: Blob);
	constructor(id?: string, file?: Blob) {
		if (id === undefined || file === undefined) {
			super();
			return;
		}

		super(id);
		this.file = file;
	}
}
//#endregion
//#region Text row
export class TextRow extends Row {
	@Field(String, { name: "text" })
	text: string;

	constructor();
	constructor(id: string, text: string);
	constructor(id?: string, text?: string) {
		if (id === undefined || text === undefined) {
			super();
			return;
		}

		super(id);
		this.text = text;
	}
}
//#endregion
