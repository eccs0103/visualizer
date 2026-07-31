"use strict";

import "adaptive-extender/web";
import { Controller, Timespan } from "adaptive-extender/web";
import { PlaylistPlayer } from "../services/playlist-player.js";
import { WakeGuard } from "../services/wake-guard.js";
import { type Track } from "../models/playlist.js";

//#region Audio controller
export class AudioController extends Controller<[WakeGuard, PlaylistPlayer, HTMLAudioElement, HTMLDivElement, HTMLButtonElement, HTMLButtonElement, HTMLElement, HTMLElement, HTMLInputElement]> {
	#audioPlayer: HTMLAudioElement;
	#player: PlaylistPlayer;
	#buttonPlaybackPrevious: HTMLButtonElement;
	#buttonPlaybackNext: HTMLButtonElement;
	#bPlaybackTitle: HTMLElement;
	#bPlaybackTime: HTMLElement;
	#inputPlaybackTrack: HTMLInputElement;
	#scrubbing: boolean = false;

	get #markReady(): boolean {
		return this.#audioPlayer.dataset["ready"] !== undefined;
	}
	set #markReady(value: boolean) {
		const { dataset } = this.#audioPlayer;
		if (value) dataset["ready"] = String.empty;
		else delete dataset["ready"];
	}

	get #markPlaying(): boolean {
		return this.#audioPlayer.dataset["playing"] !== undefined;
	}
	set #markPlaying(value: boolean) {
		if (!this.#markReady) return;
		const { dataset } = this.#audioPlayer;
		if (value) dataset["playing"] = String.empty;
		else delete dataset["playing"];
	}

	async #playToggle(value: boolean): Promise<void> {
		const audioPlayer = this.#audioPlayer;
		if (value) await audioPlayer.play();
		else audioPlayer.pause();
	}

	static #toPlaytimeString(seconds: number): string {
		const time = Timespan.fromComponents(0, 0, seconds);
		const minute = time.days * 24 + time.hours * 60 + time.minutes;
		const second = time.seconds;
		return `${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`;
	}

	#toPlaytimeInfo(seconds: number): string {
		const { duration } = this.#audioPlayer;
		const current = AudioController.#toPlaytimeString(seconds);
		if (Number.isNaN(duration)) return current;
		return `${current} • ${AudioController.#toPlaytimeString(duration)}`;
	}

	#seekFactor(): number {
		const { value, min, max } = this.#inputPlaybackTrack;
		return Number(value).lerp(Number(min), Number(max));
	}

	#seekFactorFromPoint(x: number): number {
		const { left, right } = this.#inputPlaybackTrack.getBoundingClientRect();
		return x.lerp(left, right).clamp(0, 1);
	}

	#updateSeekTrack(): void {
		const inputPlaybackTrack = this.#inputPlaybackTrack;
		const bPlaybackTime = this.#bPlaybackTime;
		const { duration } = this.#audioPlayer;
		const factor = this.#seekFactor();
		inputPlaybackTrack.style.setProperty("--track-value", `${factor * 100}%`);
		const time = (duration * factor).insteadNaN(0);
		bPlaybackTime.innerText = this.#toPlaytimeInfo(time);
	}

	#scrubTo(x: number): void {
		const audioPlayer = this.#audioPlayer;
		const inputPlaybackTrack = this.#inputPlaybackTrack;
		if (audioPlayer.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
		inputPlaybackTrack.value = `${this.#seekFactorFromPoint(x) * 100}`;
		this.#updateSeekTrack();
	}

	#commitSeek(): void {
		const audioPlayer = this.#audioPlayer;
		if (audioPlayer.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
		this.#updateSeekTrack();
		audioPlayer.currentTime = (audioPlayer.duration * this.#seekFactor()).insteadNaN(0);
	}

	#renderTrack(track: Track | null): void {
		let title = String.empty;
		if (track !== null) title = track.title;
		this.#bPlaybackTitle.innerText = title;
		this.#inputPlaybackTrack.value = "0";
		this.#inputPlaybackTrack.style.setProperty("--track-value", "0%");
		this.#bPlaybackTime.innerText = this.#toPlaytimeInfo(0);
	}

	#renderAvailability(): void {
		const isEmpty = this.#player.isEmpty;
		this.#buttonPlaybackPrevious.disabled = isEmpty;
		this.#buttonPlaybackNext.disabled = isEmpty;
	}

	async run(guard: WakeGuard, player: PlaylistPlayer, audioPlayer: HTMLAudioElement, divInterface: HTMLDivElement, buttonPlaybackPrevious: HTMLButtonElement, buttonPlaybackNext: HTMLButtonElement, bPlaybackTitle: HTMLElement, bPlaybackTime: HTMLElement, inputPlaybackTrack: HTMLInputElement): Promise<void> {
		this.#audioPlayer = audioPlayer;
		this.#player = player;
		this.#buttonPlaybackPrevious = buttonPlaybackPrevious;
		this.#buttonPlaybackNext = buttonPlaybackNext;
		this.#bPlaybackTitle = bPlaybackTitle;
		this.#bPlaybackTime = bPlaybackTime;
		this.#inputPlaybackTrack = inputPlaybackTrack;

		audioPlayer.addEventListener("canplay", event => this.#markReady = true);
		audioPlayer.addEventListener("emptied", event => this.#markReady = false);
		audioPlayer.addEventListener("play", event => this.#markPlaying = true);
		audioPlayer.addEventListener("pause", event => this.#markPlaying = false);

		audioPlayer.addEventListener("canplay", event => guard.activate("playback"));
		audioPlayer.addEventListener("emptied", event => guard.deactivate("playback"));

		audioPlayer.addEventListener("ended", async (event) => {
			const track = await player.advance();
			if (track === null) this.#markPlaying = false;
		});

		player.addEventListener("track", event => this.#renderTrack(event.detail));
		player.addEventListener("change", event => this.#renderAvailability());
		this.#renderTrack(player.current);
		this.#renderAvailability();

		bPlaybackTime.innerText = this.#toPlaytimeInfo(audioPlayer.currentTime);

		divInterface.addEventListener("click", async (event) => {
			if (audioPlayer.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
			event.stopImmediatePropagation();
			await this.#playToggle(audioPlayer.paused);
		});

		buttonPlaybackPrevious.addEventListener("click", async (event) => {
			event.stopPropagation();
			await player.retreat();
		});
		buttonPlaybackNext.addEventListener("click", async (event) => {
			event.stopPropagation();
			await player.skip();
		});

		audioPlayer.addEventListener("timeupdate", (event) => {
			if (this.#scrubbing || document.activeElement === inputPlaybackTrack) return;
			const factor = (audioPlayer.currentTime / audioPlayer.duration).insteadNaN(0);
			inputPlaybackTrack.value = `${factor * 100}`;
			inputPlaybackTrack.style.setProperty("--track-value", `${factor * 100}%`);
			bPlaybackTime.innerText = this.#toPlaytimeInfo(audioPlayer.currentTime);
		});

		inputPlaybackTrack.addEventListener("click", event => event.stopPropagation());
		inputPlaybackTrack.addEventListener("pointerdown", (event) => {
			event.stopPropagation();
			this.#scrubbing = true;
			inputPlaybackTrack.setPointerCapture(event.pointerId);
			this.#scrubTo(event.clientX);
		});
		inputPlaybackTrack.addEventListener("pointermove", (event) => {
			if (!this.#scrubbing) return;
			this.#scrubTo(event.clientX);
		});
		inputPlaybackTrack.addEventListener("pointerup", (event) => {
			this.#scrubTo(event.clientX);
			this.#commitSeek();
			this.#scrubbing = false;
			inputPlaybackTrack.blur();
		});
		inputPlaybackTrack.addEventListener("pointercancel", (event) => {
			this.#scrubbing = false;
			inputPlaybackTrack.blur();
		});

		inputPlaybackTrack.addEventListener("input", (event) => {
			if (this.#scrubbing) return;
			if (audioPlayer.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
			this.#updateSeekTrack();
		});
		inputPlaybackTrack.addEventListener("change", (event) => {
			if (this.#scrubbing) return;
			this.#commitSeek();
		});

		window.addEventListener("keydown", async (event) => {
			if (event.code !== "Space") return;
			event.preventDefault();
			await this.#playToggle(audioPlayer.paused);
		});

		window.addEventListener("keydown", async (event) => {
			if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") return;
			const { activeElement } = document;
			if (activeElement instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(activeElement.tagName)) return;
			if (document.querySelector("dialog[open]") !== null) return;
			event.preventDefault();
			if (event.code === "ArrowRight") await player.skip();
			else await player.retreat();
		});
	}
}
//#endregion
