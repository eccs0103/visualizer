"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { type Visualizer } from "../services/visualizer.js";
import { SplitterModel } from "../services/splitter.js";
import { Stem } from "../models/stem.js";
import { StemGains } from "../models/stem-gains.js";

//#region Developer controller
/** Tools for the developer only, shown when the page is opened with `?developer` and never saved: which splitter model runs, and a gain per stem array the visualizations receive. */
export class DeveloperController extends Controller<[Visualizer, HTMLDialogElement]> {
	static #parameter: string = "developer";
	static #models: readonly (readonly [string, SplitterModel])[] = [["Current", SplitterModel.current], ["Presence (test)", SplitterModel.presence]];
	static #stems: readonly Stem[] = [Stem.drums, Stem.bass, Stem.vocals, Stem.guitar, Stem.keys, Stem.other]; // the sliders in index.html, ids `developer-<stem>`

	#visualizer: Visualizer;
	#inputs: Map<Stem, HTMLInputElement> = new Map();

	#gain(stem: Stem): number {
		const input = this.#inputs.get(stem);
		if (input === undefined) throw new ReferenceError(`No slider for the '${Stem[stem]}' stem`);
		return Number(input.value);
	}

	#weigh(): void {
		this.#visualizer.weigh(new StemGains(this.#gain(Stem.drums), this.#gain(Stem.bass), this.#gain(Stem.vocals), this.#gain(Stem.guitar), this.#gain(Stem.keys), this.#gain(Stem.other)));
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
		const { splitter } = visualizer;
		selectDeveloperModel.value = String(splitter.model);
		selectDeveloperModel.addEventListener("change", event => splitter.model = Number(selectDeveloperModel.value));

		const inputs = this.#inputs;
		for (const stem of DeveloperController.#stems) {
			const name = Stem[stem];
			const inputDeveloperStem = divDeveloper.getElement(HTMLInputElement, `input#developer-${name}`);
			const outputDeveloperStem = divDeveloper.getElement(HTMLOutputElement, `output#developer-${name}-value`);
			inputDeveloperStem.addEventListener("input", (event) => {
				outputDeveloperStem.value = inputDeveloperStem.value;
				this.#weigh();
			});
			inputs.set(stem, inputDeveloperStem);
		}
	}
}
//#endregion
