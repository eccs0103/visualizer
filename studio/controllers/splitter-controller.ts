"use strict";

import "adaptive-extender/web";
import { Controller, type BufferedCell } from "adaptive-extender/web";
import { type Visualizer } from "../services/visualizer.js";
import { type SplitterCatalog } from "../models/splitter-catalog.js";
import { type Settings } from "../models/settings.js";
import { ActiveStatus, UnavailableStatus } from "../models/splitter-status.js";
import { Stem, Stems, StemGains } from "../models/stem.js";
import { Keyboard } from "../view/keyboard.js";

//#region Splitter controller
export class SplitterController extends Controller<[boolean, BufferedCell<typeof Settings>, Visualizer, HTMLDialogElement]> {
	#visualizer: Visualizer;
	#cell: BufferedCell<typeof Settings>;
	#catalog: SplitterCatalog;
	#inputs: Map<Stem, HTMLInputElement> = new Map();
	#outputVisualizerSplitter: HTMLOutputElement;
	#spanVisualizerSplitterHint: HTMLSpanElement;
	#spanSplitterModelDescription: HTMLSpanElement;

	#gain(stem: Stem): number {
		const input = this.#inputs.get(stem);
		if (input === undefined) throw new ReferenceError(`No slider for the '${Stem[stem]}' stem`);
		return Number(input.value);
	}

	#weigh(): void {
		this.#visualizer.weigh(new StemGains(this.#gain(Stem.drums), this.#gain(Stem.bass), this.#gain(Stem.vocals), this.#gain(Stem.guitar), this.#gain(Stem.keys), this.#gain(Stem.other)));
	}

	#refreshSplitter(): void {
		const { status, model } = this.#visualizer.splitter;
		const outputVisualizerSplitter = this.#outputVisualizerSplitter;
		const spanVisualizerSplitterHint = this.#spanVisualizerSplitterHint;
		const { classList } = outputVisualizerSplitter;
		outputVisualizerSplitter.value = status.summary;
		classList.toggle("alert", status instanceof UnavailableStatus);
		const slowed = status instanceof ActiveStatus && status.slowed && model !== null;
		classList.toggle("warn", slowed);
		spanVisualizerSplitterHint.hidden = !slowed;
		if (!slowed) return;
		spanVisualizerSplitterHint.innerText = `${model.name} is too heavy for this computer: it falls behind the song, so it splits it worse. Try another model, or turn the AI off. If the computer has two graphics cards, set the browser to "High performance" in the system's graphics settings.`;
	}

	#apply(): void {
		const { splitter } = this.#visualizer;
		const settings = this.#cell.content;
		const choice = settings.choice(this.#catalog);
		splitter.model = settings.splitter ? choice : null;
		this.#spanSplitterModelDescription.innerText = choice.description;
	}

	#bindStatus(sectionAiSplitter: HTMLElement): void {
		this.#outputVisualizerSplitter = sectionAiSplitter.getElement(HTMLOutputElement, "output#visualizer-splitter");
		this.#spanVisualizerSplitterHint = sectionAiSplitter.getElement(HTMLSpanElement, "span#visualizer-splitter-hint");
		this.#refreshSplitter();
		this.#visualizer.splitter.addEventListener("status", event => this.#refreshSplitter());
	}

	#bindToggle(sectionAiSplitter: HTMLElement): void {
		const cell = this.#cell;
		const settings = cell.content;
		const inputSplitterToggle = sectionAiSplitter.getElement(HTMLInputElement, "input#splitter-toggle");
		inputSplitterToggle.checked = settings.splitter;
		inputSplitterToggle.addEventListener("change", async (event) => {
			settings.splitter = inputSplitterToggle.checked;
			this.#apply();
			await cell.save(500);
		});
	}

	#bindModel(sectionAiSplitter: HTMLElement): void {
		const cell = this.#cell;
		const settings = cell.content;
		const catalog = this.#catalog;
		this.#spanSplitterModelDescription = sectionAiSplitter.getElement(HTMLSpanElement, "span#splitter-model-description");
		const selectSplitterModel = sectionAiSplitter.getElement(HTMLSelectElement, "select#splitter-model");
		for (const model of catalog.models) {
			const option = selectSplitterModel.appendChild(document.createElement("option"));
			option.translate = false;
			option.value = model.folder;
			option.innerText = model.label;
		}
		selectSplitterModel.value = settings.choice(catalog).folder;
		selectSplitterModel.addEventListener("change", async (event) => {
			settings.model = selectSplitterModel.value;
			this.#apply();
			await cell.save(500);
		});
		window.addEventListener("keydown", (event) => {
			if (!event.shiftKey) return;
			const step = Keyboard.vertical(event.code);
			if (step === 0) return;
			if (Keyboard.typing) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			if (event.repeat) return;
			Keyboard.cycle(selectSplitterModel, step);
		}, { capture: true });
	}

	#bindStems(sectionAiSplitter: HTMLElement): void {
		const inputs = this.#inputs;
		for (const stem of Stems.all) {
			const name = Stem[stem];
			const inputSplitterStem = sectionAiSplitter.getElement(HTMLInputElement, `input#splitter-${name}`);
			const outputSplitterStem = sectionAiSplitter.getElement(HTMLOutputElement, `output#splitter-${name}-value`);
			const sectionSplitterStem = inputSplitterStem.closest("section.option");
			if (sectionSplitterStem instanceof HTMLElement) sectionSplitterStem.hidden = false;
			inputSplitterStem.addEventListener("input", (event) => {
				outputSplitterStem.value = inputSplitterStem.value;
				this.#weigh();
			});
			inputs.set(stem, inputSplitterStem);
		}
	}

	async run(developer: boolean, cell: BufferedCell<typeof Settings>, visualizer: Visualizer, dialogConfigurator: HTMLDialogElement): Promise<void> {
		this.#visualizer = visualizer;
		this.#cell = cell;
		this.#catalog = await visualizer.splitter.catalog;

		const sectionAiSplitter = dialogConfigurator.getElement(HTMLElement, "section#ai-splitter");
		this.#bindStatus(sectionAiSplitter);
		this.#bindToggle(sectionAiSplitter);
		this.#bindModel(sectionAiSplitter);
		if (developer) this.#bindStems(sectionAiSplitter);
		this.#apply();
	}
}
//#endregion
