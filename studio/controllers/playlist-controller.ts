"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { PlaylistPlayer } from "../services/playlist-player.js";
import { type Track } from "../models/playlist.js";

//#region Playlist controller
export class PlaylistController extends Controller<[PlaylistPlayer, HTMLDialogElement, HTMLButtonElement, HTMLButtonElement, HTMLButtonElement, HTMLButtonElement, HTMLInputElement, HTMLOListElement, HTMLElement]> {
	#player: PlaylistPlayer;
	#dialogPlaylist: HTMLDialogElement;
	#buttonPlaylistMode: HTMLButtonElement;
	#inputAudioLoader: HTMLInputElement;
	#olPlaylistTracks: HTMLOListElement;
	#spanPlaylistEmpty: HTMLElement;

	async #setActivity(value: boolean): Promise<void> {
		const dialogPlaylist = this.#dialogPlaylist;
		const duration = 50;
		const fill: FillMode = "both";
		if (value) {
			dialogPlaylist.showModal();
			await dialogPlaylist.animate([{ opacity: "0", easing: "ease-in" }, { opacity: "1" }], { duration, fill }).finished;
		} else {
			await dialogPlaylist.animate([{ opacity: "1", easing: "ease-out" }, { opacity: "0" }], { duration, fill }).finished;
			dialogPlaylist.close();
		}
	}

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
		row.className = "rounded depth with-padding flex alt-center with-gap";
		if (index === player.index) row.dataset["active"] = String.empty;

		const handle = row.appendChild(document.createElement("span"));
		handle.className = "icon with-padding";
		handle.innerText = "Drag to reorder";
		handle.addEventListener("click", event => event.stopPropagation());

		const title = row.appendChild(document.createElement("span"));
		title.className = "title fittable";
		title.innerText = track.signature;

		const itemDuration = row.appendChild(document.createElement("b"));
		itemDuration.innerText = track.toDurationString();

		const buttonRemove = row.appendChild(document.createElement("button"));
		buttonRemove.type = "button";
		buttonRemove.className = "remove flex alt-center with-gap alert";
		const iconRemove = buttonRemove.appendChild(document.createElement("span"));
		iconRemove.className = "icon with-padding";
		iconRemove.innerText = "Remove track";

		row.addEventListener("click", async (event) => {
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

	async run(player: PlaylistPlayer, dialogPlaylist: HTMLDialogElement, buttonOpenPlaylist: HTMLButtonElement, buttonClosePlaylist: HTMLButtonElement, buttonPlaylistMode: HTMLButtonElement, buttonPlaylistAdd: HTMLButtonElement, inputAudioLoader: HTMLInputElement, olPlaylistTracks: HTMLOListElement, spanPlaylistEmpty: HTMLElement): Promise<void> {
		this.#player = player;
		this.#dialogPlaylist = dialogPlaylist;
		this.#buttonPlaylistMode = buttonPlaylistMode;
		this.#inputAudioLoader = inputAudioLoader;
		this.#olPlaylistTracks = olPlaylistTracks;
		this.#spanPlaylistEmpty = spanPlaylistEmpty;

		player.addEventListener("change", event => this.#render());
		this.#render();

		buttonOpenPlaylist.addEventListener("click", async (event) => {
			event.stopPropagation();
			await this.#setActivity(true);
		});
		buttonClosePlaylist.addEventListener("click", async (event) => {
			event.stopPropagation();
			await this.#setActivity(false);
		});
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
