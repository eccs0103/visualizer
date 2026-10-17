"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { PlaylistPlayer } from "../services/playlist-player.js";
import { FileDrop } from "../services/file-drop.js";
import { PlaylistView } from "../view/playlist-view.js";

//#region Playlist controller
export class PlaylistController extends Controller<[PlaylistPlayer, HTMLDialogElement]> {
	#player: PlaylistPlayer;
	#view: PlaylistView;

	#render(): void {
		const player = this.#player;
		this.#view.render(player.tracks, player.index, player.mode);
	}

	async #attempt(task: Promise<void>): Promise<void> {
		try {
			await task;
		} catch (reason) {
			await this.catch(Error.from(reason));
		}
	}

	async run(player: PlaylistPlayer, dialogPlaylist: HTMLDialogElement): Promise<void> {
		this.#player = player;

		const inputAudioLoader = dialogPlaylist.getElement(HTMLInputElement, "input#audio-loader");
		const buttonPlaylistMode = dialogPlaylist.getElement(HTMLButtonElement, "button#playlist-mode");
		const buttonPlaylistAdd = dialogPlaylist.getElement(HTMLButtonElement, "button#playlist-add");
		const olPlaylistTracks = dialogPlaylist.getElement(HTMLOListElement, "ol#playlist-tracks");
		const spanPlaylistEmpty = dialogPlaylist.getElement(HTMLElement, "span#playlist-empty");

		const view = this.#view = new PlaylistView(olPlaylistTracks, spanPlaylistEmpty, buttonPlaylistMode);
		const fileDrop = new FileDrop(document.body);

		player.addEventListener("change", event => this.#render());
		this.#render();

		view.addEventListener("activate", event => this.#attempt(player.activate(event.detail)));
		view.addEventListener("remove", event => this.#attempt(player.remove(event.detail)));
		view.addEventListener("reorder", event => player.move(event.detail));

		buttonPlaylistMode.addEventListener("click", (event) => {
			event.stopPropagation();
			player.nextMode();
		});
		buttonPlaylistAdd.addEventListener("click", (event) => {
			event.stopPropagation();
			inputAudioLoader.click();
		});

		inputAudioLoader.addEventListener("input", async (event) => {
			const files = ReferenceError.suppress(inputAudioLoader.files, "Unable to read files list");
			try {
				if (files.length < 1) return;
				await this.#attempt(player.add(files));
			} finally {
				inputAudioLoader.value = String.empty;
			}
		});

		fileDrop.addEventListener("files", event => this.#attempt(player.add(event.detail)));
	}
}
//#endregion
