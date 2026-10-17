"use strict";

import "adaptive-extender/web";
import { Controller, Timespan } from "adaptive-extender/web";
import { PlaylistPlayer } from "../services/playlist-player.js";
import { WakeGuard } from "../services/wake-guard.js";
import { Track } from "../models/playlist.js";
import { TextExpert } from "../services/text-expert.js";
import { Keyboard } from "../view/keyboard.js";

//#region Audio controller
export class AudioController extends Controller<[WakeGuard, PlaylistPlayer, HTMLAudioElement, HTMLDivElement]> {
	#audioPlayer: HTMLAudioElement;
	#player: PlaylistPlayer;
	#buttonPlaybackPrevious: HTMLButtonElement;
	#buttonPlaybackNext: HTMLButtonElement;
	#spanPlaybackToggle: HTMLElement;
	#bPlaybackTitle: HTMLElement;
	#bPlaybackTime: HTMLElement;
	#inputPlaybackTrack: HTMLInputElement;
	#scrubbing: boolean = false;

	#markPlaying(value: boolean): void {
		const audioPlayer = this.#audioPlayer;
		if (!audioPlayer.hasAttribute("data-ready")) return;
		audioPlayer.toggleAttribute("data-playing", value);
	}

	async #playToggle(value: boolean): Promise<void> {
		const audioPlayer = this.#audioPlayer;
		if (value) await audioPlayer.play();
		else audioPlayer.pause();
	}

	#toPlaytimeInfo(seconds: number): string {
		const { duration } = this.#audioPlayer;
		const current = TextExpert.formatDuration(Timespan.fromComponents(0, 0, seconds));
		if (Number.isNaN(duration)) return current;
		return `${current} • ${TextExpert.formatDuration(Timespan.fromComponents(0, 0, duration))}`;
	}

	#seekFactor(): number {
		const { value, min, max } = this.#inputPlaybackTrack;
		return Number(value).lerp(Number(min), Number(max));
	}

	#seekFactorFromPoint(x: number): number {
		const { left, right } = this.#inputPlaybackTrack.getBoundingClientRect();
		return x.lerp(left, right).clamp(0, 1);
	}

	#showPosition(factor: number, seconds: number): void {
		const inputPlaybackTrack = this.#inputPlaybackTrack;
		inputPlaybackTrack.value = `${factor * 100}`;
		inputPlaybackTrack.style.setProperty("--track-value", `${factor * 100}%`);
		this.#bPlaybackTime.innerText = this.#toPlaytimeInfo(seconds);
	}

	#updateSeekTrack(): void {
		const factor = this.#seekFactor();
		this.#showPosition(factor, (this.#audioPlayer.duration * factor).insteadNaN(0));
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

	#seekBy(delta: number): void {
		const audioPlayer = this.#audioPlayer;
		if (audioPlayer.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
		const { duration, currentTime } = audioPlayer;
		if (Number.isNaN(duration)) return;
		audioPlayer.currentTime = (currentTime + delta).clamp(0, duration);
	}

	#renderTrack(track: Track | null): void {
		let signature = "Open the playlist or drop music here";
		if (track !== null) signature = track.signature;
		const bPlaybackTitle = this.#bPlaybackTitle;
		bPlaybackTitle.translate = track === null;
		bPlaybackTitle.innerText = signature;
		this.#showPosition(0, 0);
	}

	#renderAvailability(): void {
		const isEmpty = this.#player.isEmpty;
		this.#buttonPlaybackPrevious.disabled = isEmpty;
		this.#buttonPlaybackNext.disabled = isEmpty;
		this.#spanPlaybackToggle.ariaDisabled = String(isEmpty);
	}

	async run(guard: WakeGuard, player: PlaylistPlayer, audioPlayer: HTMLAudioElement, divInterface: HTMLDivElement): Promise<void> {
		this.#audioPlayer = audioPlayer;
		this.#player = player;
		const buttonPlaybackPrevious = this.#buttonPlaybackPrevious = divInterface.getElement(HTMLButtonElement, "button#playback-previous");
		const buttonPlaybackNext = this.#buttonPlaybackNext = divInterface.getElement(HTMLButtonElement, "button#playback-next");
		this.#spanPlaybackToggle = divInterface.getElement(HTMLElement, "#playback-control > span.icon");
		this.#bPlaybackTitle = divInterface.getElement(HTMLElement, "b#playback-title");
		const bPlaybackTime = this.#bPlaybackTime = divInterface.getElement(HTMLElement, "b#playback-time");
		const inputPlaybackTrack = this.#inputPlaybackTrack = divInterface.getElement(HTMLInputElement, "input#playback-track");

		audioPlayer.addEventListener("canplay", event => audioPlayer.toggleAttribute("data-ready", true));
		audioPlayer.addEventListener("emptied", event => audioPlayer.toggleAttribute("data-ready", false));
		audioPlayer.addEventListener("play", event => this.#markPlaying(true));
		audioPlayer.addEventListener("pause", event => this.#markPlaying(false));

		audioPlayer.addEventListener("canplay", event => guard.activate("playback"));
		audioPlayer.addEventListener("emptied", event => guard.deactivate("playback"));

		audioPlayer.addEventListener("ended", async (event) => {
			const track = await player.advance();
			if (track === null) this.#markPlaying(false);
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
			const { currentTime, duration } = audioPlayer;
			this.#showPosition((currentTime / duration).insteadNaN(0), currentTime);
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
			if (event.repeat) return;
			if (Keyboard.typing) return;
			event.preventDefault();
			await this.#playToggle(audioPlayer.paused);
		});

		window.addEventListener("keydown", async (event) => {
			const step = Keyboard.horizontal(event.code);
			if (step === 0) return;
			if (Keyboard.typing) return;
			if (document.querySelector("dialog[open]") !== null) return;
			event.preventDefault();
			if (!event.shiftKey) return this.#seekBy(step * 5);
			if (event.repeat) return;
			if (step > 0) await player.skip();
			else await player.retreat();
		});
	}
}
//#endregion
