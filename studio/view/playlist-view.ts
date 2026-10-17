"use strict";

import "adaptive-extender/web";
import { Timespan } from "adaptive-extender/web";
import { type Track, PlaybackMode } from "../models/playlist.js";
import { type Reorder } from "../models/reorder.js";
import { TextExpert } from "../services/text-expert.js";
import { DOMBuilder } from "./dom-builder.js";
import { RowDrag } from "./row-drag.js";

//#region Playlist view
export interface PlaylistViewEventMap {
	"activate": CustomEvent<number>;
	"remove": CustomEvent<string>;
	"reorder": CustomEvent<Reorder>;
}

export class PlaylistView extends EventTarget {
	static #titles: Map<PlaybackMode, string> = new Map([
		[PlaybackMode.once, "Play once"],
		[PlaybackMode.one, "Repeat track"],
		[PlaybackMode.loop, "Loop playlist"],
		[PlaybackMode.shuffle, "Shuffle"],
	]);

	#olPlaylistTracks: HTMLOListElement;
	#spanPlaylistEmpty: HTMLElement;
	#buttonPlaylistMode: HTMLButtonElement;
	#spanPlaylistModeLabel: HTMLSpanElement;
	#rows: Map<string, HTMLLIElement> = new Map();
	#order: string[] = [];

	constructor(olPlaylistTracks: HTMLOListElement, spanPlaylistEmpty: HTMLElement, buttonPlaylistMode: HTMLButtonElement) {
		super();
		this.#olPlaylistTracks = olPlaylistTracks;
		this.#spanPlaylistEmpty = spanPlaylistEmpty;
		this.#buttonPlaylistMode = buttonPlaylistMode;
		this.#spanPlaylistModeLabel = buttonPlaylistMode.getElement(HTMLSpanElement, "span#playlist-mode-label");
		olPlaylistTracks.addEventListener("click", this.#onClick.bind(this));
		const drag = new RowDrag(olPlaylistTracks, ":scope > li");
		drag.addEventListener("reorder", event => this.dispatchEvent(new CustomEvent("reorder", { detail: event.detail })));
	}

	addEventListener<K extends keyof PlaylistViewEventMap>(type: K, listener: (this: PlaylistView, event: PlaylistViewEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		return super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof PlaylistViewEventMap>(type: K, listener: (this: PlaylistView, event: PlaylistViewEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		return super.removeEventListener(type, listener, options);
	}

	#findTrackRow(event: Event): HTMLLIElement | undefined {
		return event.composedPath().find(node => node instanceof HTMLLIElement);
	}

	#findClassAncestor(event: Event, name: string): HTMLElement | undefined {
		return event.composedPath().find((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains(name));
	}

	#buildTrackRow(track: Track): HTMLLIElement {
		const row = document.createElement("li");
		row.classList.add("rounded", "depth", "flex");
		row.translate = true;
		row.dataset["id"] = track.id;

		DOMBuilder.newHandle(row);

		const content = row.appendChild(document.createElement("span"));
		content.classList.add("content", "flex", "alt-center", "with-gap");
		content.translate = true;
		DOMBuilder.newTitle(content, track.signature);
		DOMBuilder.newLyricsMark(content).hidden = !track.lyrics;
		DOMBuilder.newDuration(content, Timespan.fromComponents(0, 0, track.duration));

		DOMBuilder.newRemoveButton(row);

		return row;
	}

	#syncTrackRow(row: HTMLLIElement, track: Track, isActive: boolean): void {
		row.toggleAttribute("data-active", isActive);
		row.ariaDisabled = String(track.isPending);
		row.getElement(HTMLElement, "span.title").innerText = track.signature;
		row.getElement(HTMLElement, "span.lyrics-mark").hidden = !track.lyrics;
		row.getElement(HTMLElement, "b").innerText = TextExpert.formatDuration(Timespan.fromComponents(0, 0, track.duration));
	}

	#onClick(event: MouseEvent): void {
		const row = this.#findTrackRow(event);
		if (row === undefined) return;
		if (this.#findClassAncestor(event, "handle") !== undefined) return;
		event.stopPropagation();
		const id = ReferenceError.suppress(row.dataset["id"], "Playlist row missing id");

		if (this.#findClassAncestor(event, "remove") !== undefined) {
			this.dispatchEvent(new CustomEvent("remove", { detail: id }));
			return;
		}

		const index = this.#order.indexOf(id);
		if (index < 0) return;
		this.dispatchEvent(new CustomEvent("activate", { detail: index }));
	}

	render(tracks: readonly Track[], activeIndex: number, mode: PlaybackMode): void {
		const olPlaylistTracks = this.#olPlaylistTracks;
		const rows = this.#rows;
		const ids = new Set(tracks.map(track => track.id));

		let focused: HTMLElement | null = null;
		if (document.activeElement instanceof HTMLElement && olPlaylistTracks.contains(document.activeElement)) focused = document.activeElement;

		for (const [id, row] of rows) {
			if (ids.has(id)) continue;
			row.remove();
			rows.delete(id);
		}

		let previous: HTMLLIElement | null = null;
		for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
			const track = tracks[trackIndex];
			let row = rows.get(track.id);
			if (row === undefined) {
				row = this.#buildTrackRow(track);
				rows.set(track.id, row);
			}
			this.#syncTrackRow(row, track, trackIndex === activeIndex);

			let after: Element | null = olPlaylistTracks.firstElementChild;
			if (previous !== null) after = previous.nextElementSibling;
			if (after !== row) olPlaylistTracks.insertBefore(row, after);
			previous = row;
		}

		this.#order = tracks.map(track => track.id);
		this.#spanPlaylistEmpty.hidden = tracks.length > 0;
		const buttonPlaylistMode = this.#buttonPlaylistMode;
		buttonPlaylistMode.dataset["mode"] = mode;
		this.#spanPlaylistModeLabel.innerText = ReferenceError.suppress(PlaylistView.#titles.get(mode));

		if (focused !== null && olPlaylistTracks.contains(focused) && document.activeElement !== focused) focused.focus({ preventScroll: true });
	}
}
//#endregion
