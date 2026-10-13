"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { type Visualizer } from "../services/visualizer.js";
import { SplitterModel } from "../services/splitter.js";
import { Stem, StemGains } from "../models/stem.js";
import { type Audience, Audiences } from "../models/audience.js";
import { ArrowKeys } from "../view/arrow-keys.js";

//#region Splitter controller
export class SplitterController extends Controller<[Audience, Visualizer, HTMLDialogElement]> {
	static #models: (readonly [string, SplitterModel])[] = [
		["Standard (1.7M)", SplitterModel.standard],
		["Presence (1.7M)", SplitterModel.presence],
		["Long memory (1.7M)", SplitterModel.memory]
	];
	static #stems: readonly Stem[] = [Stem.drums, Stem.bass, Stem.vocals, Stem.guitar, Stem.keys, Stem.other];

	#visualizer: Visualizer;
	#inputs: Map<Stem, HTMLInputElement> = new Map();
	#outputVisualizerSplitter: HTMLOutputElement;
	#spanVisualizerSplitterHint: HTMLSpanElement;

	#gain(stem: Stem): number {
		const input = this.#inputs.get(stem);
		if (input === undefined) throw new ReferenceError(`No slider for the '${Stem[stem]}' stem`);
		return Number(input.value);
	}

	#weigh(): void {
		this.#visualizer.weigh(new StemGains(this.#gain(Stem.drums), this.#gain(Stem.bass), this.#gain(Stem.vocals), this.#gain(Stem.guitar), this.#gain(Stem.keys), this.#gain(Stem.other)));
	}

	#refreshSplitter(): void {
		const splitter = this.#visualizer.splitter.status;
		const outputVisualizerSplitter = this.#outputVisualizerSplitter;
		const spanVisualizerSplitterHint = this.#spanVisualizerSplitterHint;
		spanVisualizerSplitterHint.hidden = true;
		if (splitter === null) {
			outputVisualizerSplitter.value = "Loading…";
			return;
		}
		const { available, reason, device, rate, slowed } = splitter;
		if (!available) {
			outputVisualizerSplitter.value = reason === null ? "Unavailable" : `Unavailable\n${reason}`;
			return;
		}
		const parts = ["Active"];
		if (device !== null) parts.push(device);
		if (rate !== null) parts.push(`${rate} updates/s`);
		outputVisualizerSplitter.value = parts.join("\n");
		spanVisualizerSplitterHint.hidden = !slowed;
	}

	#bindStatus(sectionAiSplitter: HTMLElement): void {
		this.#outputVisualizerSplitter = sectionAiSplitter.getElement(HTMLOutputElement, "output#visualizer-splitter");
		this.#spanVisualizerSplitterHint = sectionAiSplitter.getElement(HTMLSpanElement, "span#visualizer-splitter-hint");
		this.#refreshSplitter();
		this.#visualizer.splitter.addEventListener("status", event => this.#refreshSplitter());
	}

	#bindModel(sectionAiSplitter: HTMLElement): void {
		const selectSplitterModel = sectionAiSplitter.getElement(HTMLSelectElement, "select#splitter-model");
		for (const [label, model] of SplitterController.#models) {
			const option = selectSplitterModel.appendChild(document.createElement("option"));
			option.translate = false;
			option.value = String(model);
			option.innerText = label;
		}
		const { splitter } = this.#visualizer;
		selectSplitterModel.value = String(splitter.model);
		selectSplitterModel.addEventListener("change", event => splitter.model = Number(selectSplitterModel.value));
		window.addEventListener("keydown", (event) => {
			if (!event.shiftKey) return;
			const step = ArrowKeys.vertical(event.code);
			if (step === 0) return;
			const { activeElement } = document;
			if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLSelectElement || activeElement instanceof HTMLTextAreaElement) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			if (event.repeat) return;
			ArrowKeys.cycle(selectSplitterModel, step);
		}, { capture: true });
	}

	#bindStems(sectionAiSplitter: HTMLElement): void {
		const inputs = this.#inputs;
		for (const stem of SplitterController.#stems) {
			const name = Stem[stem];
			const inputSplitterStem = sectionAiSplitter.getElement(HTMLInputElement, `input#splitter-${name}`);
			const outputSplitterStem = sectionAiSplitter.getElement(HTMLOutputElement, `output#splitter-${name}-value`);
			inputSplitterStem.addEventListener("input", (event) => {
				outputSplitterStem.value = inputSplitterStem.value;
				this.#weigh();
			});
			inputs.set(stem, inputSplitterStem);
		}
	}

	async run(audience: Audience, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement): Promise<void> {
		if (!Audiences.isDeveloper(audience)) return;
		this.#visualizer = visualizer;

		const sectionAiSplitter = dialogConfigurator.getElement(HTMLElement, "section#ai-splitter");
		sectionAiSplitter.hidden = false;

		this.#bindStatus(sectionAiSplitter);
		this.#bindModel(sectionAiSplitter);
		this.#bindStems(sectionAiSplitter);
	}
}
//#endregion
