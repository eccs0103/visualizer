"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { Visualizer, SplitterModel } from "../services/visualizer.js";

//#region Developer controller
/** Tools for the developer only, shown when the page is opened with `?developer` and never saved: which splitter model runs, and a gain per stem array the visualizations receive. */
export class DeveloperController extends Controller<[Visualizer, HTMLDialogElement]> {
	static #parameter: string = "developer";
	static #models: readonly (readonly [string, SplitterModel])[] = [["Current", SplitterModel.current], ["Presence (test)", SplitterModel.presence]];
	static #stems: readonly string[] = ["drums", "bass", "vocals", "guitar", "keys", "other"]; // the Audioset order, and the ids in index.html

	#visualizer: Visualizer;
	#inputs: HTMLInputElement[] = [];

	#weigh(): void {
		this.#visualizer.weigh(this.#inputs.map(input => Number(input.value)));
	}

	async run(visualizer: Visualizer, dialogConfigurator: HTMLDialogElement): Promise<void> {
		if (!new URL(location.href).searchParams.has(DeveloperController.#parameter)) return;
		this.#visualizer = visualizer;

		const divDeveloper = dialogConfigurator.getElement(HTMLDivElement, "div#developer");
		divDeveloper.hidden = false;

		const selectDeveloperModel = divDeveloper.getElement(HTMLSelectElement, "select#developer-model");
		for (const [label, model] of DeveloperController.#models) {
			const option = selectDeveloperModel.appendChild(document.createElement("option"));
			option.value = String(model);
			option.innerText = label;
		}
		selectDeveloperModel.value = String(visualizer.model);
		selectDeveloperModel.addEventListener("change", event => visualizer.model = Number(selectDeveloperModel.value));

		const inputs = this.#inputs;
		for (const stem of DeveloperController.#stems) {
			const inputDeveloperStem = divDeveloper.getElement(HTMLInputElement, `input#developer-${stem}`);
			const outputDeveloperStem = divDeveloper.getElement(HTMLOutputElement, `output#developer-${stem}-value`);
			inputDeveloperStem.addEventListener("input", (event) => {
				outputDeveloperStem.value = inputDeveloperStem.value;
				this.#weigh();
			});
			inputs.push(inputDeveloperStem);
		}
	}
}
//#endregion
