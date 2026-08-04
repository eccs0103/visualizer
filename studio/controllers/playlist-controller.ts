"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { PlaylistPlayer } from "../services/playlist-player.js";
import { FileDrop } from "../services/file-drop.js";
import { PlaylistView } from "../view/playlist-view.js";
import { type Reorder } from "../models/playlist.js";

//#region Playlist controller
export class PlaylistController extends Controller<[PlaylistPlayer, HTMLDialogElement]> {
	#player: PlaylistPlayer;
	#view: PlaylistView;

	#render(): void {
		this.#view.render(this.#player.tracks, this.#player.index, this.#player.mode);
	}

	async #onActivate(event: CustomEvent<number>): Promise<void> {
		try {
			await this.#player.activate(event.detail);
		} catch (reason) {
			await this.catch(Error.from(reason));
		}
	}

	async #onRemove(event: CustomEvent<string>): Promise<void> {
		try {
			await this.#player.remove(event.detail);
		} catch (reason) {
			await this.catch(Error.from(reason));
		}
	}

	#onReorder(event: CustomEvent<Reorder>): void {
		const { from, to } = event.detail;
		this.#player.move(from, to);
	}

	async #onFiles(files: Iterable<File>): Promise<void> {
		try {
			await this.#player.add(files);
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

		view.addEventListener("activate", this.#onActivate.bind(this));
		view.addEventListener("remove", this.#onRemove.bind(this));
		view.addEventListener("reorder", this.#onReorder.bind(this));

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
				await this.#onFiles(files);
			} finally {
				inputAudioLoader.value = String.empty;
			}
		});

		fileDrop.addEventListener("files", event => this.#onFiles(event.detail));
	}
}
//#endregion
