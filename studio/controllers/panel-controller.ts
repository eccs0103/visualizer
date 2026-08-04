"use strict";

import "adaptive-extender/web";
import { Controller, BufferedCell } from "adaptive-extender/web";
import { Settings, Panel } from "../models/settings.js";

//#region Panel controller
export class PanelController extends Controller<[BufferedCell<typeof Settings>, HTMLDialogElement, HTMLDialogElement, HTMLButtonElement, HTMLButtonElement, HTMLButtonElement, HTMLButtonElement]> {
	#cell: BufferedCell<typeof Settings>;
	#dialogs: Map<Panel, HTMLDialogElement>;
	#panel: Panel = Panel.none;

	async #setActivity(dialog: HTMLDialogElement, value: boolean): Promise<void> {
		if (dialog.open === value) return;
		const duration = 50;
		const fill: FillMode = "both";
		if (value) {
			dialog.showModal();
			await dialog.animate([{ opacity: "0", easing: "ease-in" }, { opacity: "1" }], { duration, fill }).finished;
		} else {
			await dialog.animate([{ opacity: "1", easing: "ease-out" }, { opacity: "0" }], { duration, fill }).finished;
			dialog.close();
		}
	}

	async #activate(next: Panel): Promise<void> {
		const current = this.#panel;
		if (current === next) return;
		this.#panel = next;

		const outgoing = this.#dialogs.get(current);
		if (outgoing !== undefined) await this.#setActivity(outgoing, false);

		const incoming = this.#dialogs.get(next);
		if (incoming !== undefined) await this.#setActivity(incoming, true);

		const settings = this.#cell.content;
		settings.panel = next;
		await this.#cell.save(500);
	}

	async #toggle(panel: Panel): Promise<void> {
		await this.#activate(this.#panel === panel ? Panel.none : panel);
	}

	#isOutside(dialog: HTMLDialogElement, event: MouseEvent): boolean {
		if (event.target !== dialog) return false;
		const { left, right, top, bottom } = dialog.getBoundingClientRect();
		return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
	}

	async run(cell: BufferedCell<typeof Settings>, dialogPlaylist: HTMLDialogElement, dialogConfigurator: HTMLDialogElement, buttonOpenPlaylist: HTMLButtonElement, buttonClosePlaylist: HTMLButtonElement, buttonOpenConfigurator: HTMLButtonElement, buttonCloseConfigurator: HTMLButtonElement): Promise<void> {
		this.#cell = cell;
		this.#dialogs = new Map([
			[Panel.playlist, dialogPlaylist],
			[Panel.configurator, dialogConfigurator],
		]);

		for (const [panel, dialog] of this.#dialogs) {
			dialog.addEventListener("close", async (event) => {
				if (this.#panel !== panel) return;
				this.#panel = Panel.none;
				const settings = this.#cell.content;
				settings.panel = Panel.none;
				await this.#cell.save(500);
			});
			dialog.addEventListener("click", async (event) => {
				if (!this.#isOutside(dialog, event)) return;
				await this.#activate(Panel.none);
			});
		}

		buttonOpenPlaylist.addEventListener("click", async (event) => {
			event.stopPropagation();
			await this.#activate(Panel.playlist);
		});
		buttonClosePlaylist.addEventListener("click", async (event) => {
			event.stopPropagation();
			await this.#activate(Panel.none);
		});
		buttonOpenConfigurator.addEventListener("click", async (event) => {
			event.stopPropagation();
			await this.#activate(Panel.configurator);
		});
		buttonCloseConfigurator.addEventListener("click", async (event) => {
			event.stopPropagation();
			await this.#activate(Panel.none);
		});

		window.addEventListener("keydown", async (event) => {
			if (event.code !== "Tab") return;
			if (event.repeat) return;
			event.preventDefault();
			await this.#toggle(event.shiftKey ? Panel.playlist : Panel.configurator);
		});

		await this.#activate(cell.content.panel);
	}
}
//#endregion
