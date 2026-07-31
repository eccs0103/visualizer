"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { PlaylistPlayer } from "../services/playlist-player.js";
import { type Track } from "../models/playlist.js";

//#region Playlist controller
export class PlaylistController extends Controller<[PlaylistPlayer, HTMLButtonElement, HTMLButtonElement, HTMLInputElement, HTMLOListElement, HTMLElement]> {
	#player: PlaylistPlayer;
	#buttonPlaylistMode: HTMLButtonElement;
	#inputAudioLoader: HTMLInputElement;
	#olPlaylistTracks: HTMLOListElement;
	#spanPlaylistEmpty: HTMLElement;

	#wireDrag(row: HTMLLIElement, handle: HTMLElement): void {
		const olPlaylistTracks = this.#olPlaylistTracks;
		const player = this.#player;
		let siblings: HTMLLIElement[] = [];
		let rowHeight = 0;
		let startY = 0;
		let from = -1;
		let target = -1;

		const shiftTo = (next: number): void => {
			for (const sibling of siblings) if (sibling !== row) sibling.style.transform = String.empty;
			if (next < from) for (let index = next; index < from; index++) siblings[index].style.transform = `translateY(${rowHeight}px)`;
			else if (next > from) for (let index = from + 1; index <= next; index++) siblings[index].style.transform = `translateY(${-rowHeight}px)`;
			target = next;
		};

		const reset = (): void => {
			for (const sibling of siblings) sibling.style.transform = String.empty;
			row.style.zIndex = String.empty;
			delete row.dataset["dragging"];
			siblings = [];
			from = -1;
			target = -1;
		};

		handle.addEventListener("pointerdown", (event) => {
			event.stopPropagation();
			siblings = Array.from(olPlaylistTracks.children) as HTMLLIElement[];
			from = siblings.indexOf(row);
			target = from;
			rowHeight = row.getBoundingClientRect().height;
			if (siblings.length > 1) rowHeight = siblings[1].getBoundingClientRect().top - siblings[0].getBoundingClientRect().top;
			startY = event.clientY;
			handle.setPointerCapture(event.pointerId);
			row.dataset["dragging"] = String.empty;
			row.style.zIndex = "1";
		});
		handle.addEventListener("pointermove", (event) => {
			if (from < 0) return;
			const delta = event.clientY - startY;
			row.style.transform = `translateY(${delta}px)`;
			const next = Math.round(from + delta / rowHeight).clamp(0, siblings.length - 1);
			if (next !== target) shiftTo(next);
		});
		handle.addEventListener("pointerup", (event) => {
			const start = from;
			const to = target;
			row.style.transform = String.empty;
			reset();
			if (start < 0 || to === start) return;
			player.move(start, to);
		});
		handle.addEventListener("pointercancel", (event) => {
			row.style.transform = String.empty;
			reset();
		});
	}

	#buildRow(track: Track, index: number): HTMLLIElement {
		const player = this.#player;
		const row = document.createElement("li");
		row.dataset["id"] = track.id;
		row.className = "rounded depth flex";
		if (index === player.index) row.dataset["active"] = String.empty;

		const handle = row.appendChild(document.createElement("span"));
		handle.className = "handle with-padding flex alt-center";
		const iconHandle = handle.appendChild(document.createElement("span"));
		iconHandle.className = "icon with-padding";
		iconHandle.innerText = "Drag to reorder";

		const content = row.appendChild(document.createElement("span"));
		content.className = "content flex alt-center with-gap";

		const title = content.appendChild(document.createElement("span"));
		title.className = "title fittable";
		title.innerText = track.signature;

		const itemDuration = content.appendChild(document.createElement("b"));
		itemDuration.innerText = track.toDurationString();

		const buttonRemove = row.appendChild(document.createElement("button"));
		buttonRemove.type = "button";
		buttonRemove.className = "remove with-padding flex alt-center alert";
		const iconRemove = buttonRemove.appendChild(document.createElement("span"));
		iconRemove.className = "icon with-padding";
		iconRemove.innerText = "Remove track";

		content.addEventListener("click", async (event) => {
			event.stopPropagation();
			await player.activate(index);
		});
		buttonRemove.addEventListener("click", async (event) => {
			event.stopPropagation();
			await player.remove(track.id);
		});
		this.#wireDrag(row, handle);

		return row;
	}

	#render(): void {
		const player = this.#player;
		const olPlaylistTracks = this.#olPlaylistTracks;

		olPlaylistTracks.replaceChildren(...player.tracks.map((track, index) => this.#buildRow(track, index)));
		this.#spanPlaylistEmpty.hidden = !player.isEmpty;
		this.#buttonPlaylistMode.dataset["mode"] = player.mode;
	}

	async run(player: PlaylistPlayer, buttonPlaylistMode: HTMLButtonElement, buttonPlaylistAdd: HTMLButtonElement, inputAudioLoader: HTMLInputElement, olPlaylistTracks: HTMLOListElement, spanPlaylistEmpty: HTMLElement): Promise<void> {
		this.#player = player;
		this.#buttonPlaylistMode = buttonPlaylistMode;
		this.#inputAudioLoader = inputAudioLoader;
		this.#olPlaylistTracks = olPlaylistTracks;
		this.#spanPlaylistEmpty = spanPlaylistEmpty;

		player.addEventListener("change", event => this.#render());
		this.#render();

		buttonPlaylistMode.addEventListener("click", (event) => {
			event.stopPropagation();
			player.cycleMode();
		});
		buttonPlaylistAdd.addEventListener("click", (event) => {
			event.stopPropagation();
			inputAudioLoader.click();
		});

		inputAudioLoader.addEventListener("input", async (event) => {
			try {
				const files = ReferenceError.suppress(inputAudioLoader.files, "Unable to read files list");
				if (files.length < 1) return;
				await player.add(files);
			} catch (reason) {
				await this.catch(Error.from(reason));
			} finally {
				inputAudioLoader.value = String.empty;
			}
		});

		document.body.addEventListener("dragover", (event) => {
			const { dataTransfer } = event;
			if (dataTransfer === null) return;
			if (!Array.from(dataTransfer.items).some(item => item.kind === "file")) return;
			event.preventDefault();
		});
		document.body.addEventListener("drop", async (event) => {
			const { dataTransfer } = event;
			if (dataTransfer === null) return;
			const { files } = dataTransfer;
			if (files.length < 1) return;
			event.preventDefault();
			try {
				await player.add(files);
			} catch (reason) {
				await this.catch(Error.from(reason));
			}
		});
	}
}
//#endregion
