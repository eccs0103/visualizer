"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";

//#region Redirect controller
class RedirectController extends Controller {
	async run(): Promise<void> {
		const meta = document.getElement(HTMLMetaElement, "meta[http-equiv=\"refresh\"]");
		const content = meta.getAttribute("content");
		if (content === null) return;
		const parts = content.split("url=", 2);
		if (parts.length < 2) return;
		const [, destination] = parts;
		location.replace(destination);
	}
}
//#endregion

await RedirectController.launch();
