"use strict";

import "adaptive-extender/web";
import { Timespan } from "adaptive-extender/web";
import { type Track, type PlaybackMode, Reorder } from "../models/playlist.js";
import { TextExpert } from "../services/text-expert.js";
import { DOMBuilder } from "./dom-builder.js";
import { TrackDrag } from "./track-drag.js";

//#region Playlist view
export interface PlaylistViewEventMap {
	"activate": CustomEvent<number>;
	"remove": CustomEvent<string>;
	"reorder": CustomEvent<Reorder>;
}

export class PlaylistView extends EventTarget {
	#olPlaylistTracks: HTMLOListElement;
	#spanPlaylistEmpty: HTMLElement;
	#buttonPlaylistMode: HTMLButtonElement;
	#rows: Map<string, HTMLLIElement> = new Map();
	#order: string[] = [];
	#drag: TrackDrag | null = null;

	constructor(olPlaylistTracks: HTMLOListElement, spanPlaylistEmpty: HTMLElement, buttonPlaylistMode: HTMLButtonElement) {
		super();
		this.#olPlaylistTracks = olPlaylistTracks;
		this.#spanPlaylistEmpty = spanPlaylistEmpty;
		this.#buttonPlaylistMode = buttonPlaylistMode;
		olPlaylistTracks.addEventListener("click", this.#onClick.bind(this));
		olPlaylistTracks.addEventListener("pointerdown", this.#onPointerDown.bind(this));
		olPlaylistTracks.addEventListener("pointermove", this.#onPointerMove.bind(this));
		olPlaylistTracks.addEventListener("pointerup", this.#onPointerUp.bind(this));
		olPlaylistTracks.addEventListener("pointercancel", this.#onPointerCancel.bind(this));
		olPlaylistTracks.addEventListener("keydown", this.#onKeyDown.bind(this));
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

	#readDirection(code: string): number {
		switch (code) {
		case "ArrowUp": return -1;
		case "ArrowDown": return 1;
		default: return 0;
		}
	}

	#buildTrackRow(track: Track): HTMLLIElement {
		const row = document.createElement("li");
		row.classList.add("rounded", "depth", "flex");
		row.dataset["id"] = track.id;

		DOMBuilder.newHandle(row);

		const content = row.appendChild(document.createElement("span"));
		content.classList.add("content", "flex", "alt-center", "with-gap");
		DOMBuilder.newTitle(content, track.signature);
		DOMBuilder.newDuration(content, Timespan.fromComponents(0, 0, track.duration));

		DOMBuilder.newRemoveButton(row);

		return row;
	}

	#syncTrackRow(row: HTMLLIElement, track: Track, isActive: boolean): void {
		if (isActive) row.dataset["active"] = String.empty;
		else delete row.dataset["active"];
		row.getElement(HTMLElement, "span.title").innerText = track.signature;
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

	#onPointerDown(event: PointerEvent): void {
		const handle = this.#findClassAncestor(event, "handle");
		if (handle === undefined) return;
		const row = this.#findTrackRow(event);
		if (row === undefined) return;
		event.stopPropagation();
		handle.setPointerCapture(event.pointerId);
		const rows = Array.from(this.#olPlaylistTracks.getElements(HTMLLIElement, ":scope > li"));
		this.#drag = new TrackDrag(row, rows, event.clientY);
	}

	#onPointerMove(event: PointerEvent): void {
		if (this.#drag === null) return;
		this.#drag.track(event.clientY);
	}

	#onPointerUp(event: PointerEvent): void {
		if (this.#drag === null) return;
		const reorder = this.#drag.commit();
		this.#drag = null;
		if (!reorder.isEffective) return;
		this.dispatchEvent(new CustomEvent("reorder", { detail: reorder }));
	}

	#onPointerCancel(event: PointerEvent): void {
		if (this.#drag === null) return;
		this.#drag.cancel();
		this.#drag = null;
	}

	#onKeyDown(event: KeyboardEvent): void {
		const step = this.#readDirection(event.code);
		if (step === 0) return;
		const handle = this.#findClassAncestor(event, "handle");
		if (handle === undefined) return;
		const row = this.#findTrackRow(event);
		if (row === undefined) return;
		const id = ReferenceError.suppress(row.dataset["id"], "Playlist row missing id");
		const from = this.#order.indexOf(id);
		if (from < 0) return;
		const to = (from + step).clamp(0, this.#order.length - 1);
		event.preventDefault();
		const reorder = new Reorder(from, to);
		if (!reorder.isEffective) return;
		this.dispatchEvent(new CustomEvent("reorder", { detail: reorder }));
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
		this.#buttonPlaylistMode.dataset["mode"] = mode;

		if (focused !== null && olPlaylistTracks.contains(focused) && document.activeElement !== focused) focused.focus({ preventScroll: true });
	}
}
//#endregion
