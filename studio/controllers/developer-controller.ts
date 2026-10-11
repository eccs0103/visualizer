"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { type Visualizer } from "../services/visualizer.js";
import { SplitterModel } from "../services/splitter.js";
import { Stem, StemGains } from "../models/stem.js";

//#region Developer controller
export class DeveloperController extends Controller<[Visualizer, HTMLDialogElement]> {
	static #parameter: string = "developer";
	static #models: readonly (readonly [string, SplitterModel])[] = [["Current", SplitterModel.current], ["Presence (test)", SplitterModel.presence], ["c64 (test)", SplitterModel.c64]];
	static #stems: readonly Stem[] = [Stem.drums, Stem.bass, Stem.vocals, Stem.guitar, Stem.keys, Stem.other];

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

	#direction(code: string): number {
		switch (code) {
		case "ArrowUp": return -1;
		case "ArrowDown": return 1;
		default: return 0;
		}
	}

	#cycle(select: HTMLSelectElement, step: number): void {
		select.selectedIndex = (select.selectedIndex + step).mod(select.length);
		select.dispatchEvent(new Event("change"));
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
		window.addEventListener("keydown", (event) => {
			if (!event.shiftKey) return;
			const step = this.#direction(event.code);
			if (step === 0) return;
			const { activeElement } = document;
			if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLSelectElement || activeElement instanceof HTMLTextAreaElement) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			if (event.repeat) return;
			this.#cycle(selectDeveloperModel, step);
		}, { capture: true });

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
