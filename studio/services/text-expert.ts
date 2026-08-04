"use strict";

import "adaptive-extender/core";
import { type Timespan } from "adaptive-extender/core";

//#region Text expert
export class TextExpert {
	static formatDuration(time: Readonly<Timespan>): string {
		const minute = time.days * 24 + time.hours * 60 + time.minutes;
		const second = time.seconds;
		return `${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`;
	}
}
//#endregion
