"use strict";

import "adaptive-extender/web";
import { Controller, Timespan } from "adaptive-extender/web";
import { ObjectStore } from "../services/object-store.js";
import { WakeGuard } from "../services/wake-guard.js";

//#region Audio controller
export class AudioController extends Controller<[WakeGuard, ObjectStore, HTMLAudioElement, HTMLInputElement, HTMLDivElement, HTMLButtonElement, HTMLElement, HTMLInputElement]> {
	#audioPlayer: HTMLAudioElement;
	#store: ObjectStore;
	#bPlaybackTime: HTMLElement;
	#inputPlaybackTrack: HTMLInputElement;
	#isSeeking: boolean = false;

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

	async #loadAudio(file: File): Promise<void> {
		const audioPlayer = this.#audioPlayer;
		await Promise.withSignal((signal, resolve, reject) => {
			audioPlayer.addEventListener("canplay", event => resolve(), { signal });
			audioPlayer.addEventListener("error", event => reject(new Error("Failed to load audio file")), { signal });
			audioPlayer.src = URL.createObjectURL(file);
		});
	}

	#dropAudio(): void {
		const audioPlayer = this.#audioPlayer;
		audioPlayer.removeAttribute("src");
		audioPlayer.srcObject = null;
	}

	async #loadRecentAudio(): Promise<void> {
		const file = await this.#store.get(0);
		if (!(file instanceof File)) return;
		await this.#loadAudio(file);
	}

	async #saveRecentAudio(file: File | null): Promise<void> {
		const store = this.#store;
		if (file === null) {
			this.#dropAudio();
			await store.delete(0);
		} else {
			await this.#loadAudio(file);
			await store.put(0, file);
		}
	}

	#seekFactor(): number {
		const { value, min, max } = this.#inputPlaybackTrack;
		return Number(value).lerp(Number(min), Number(max));
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

	async run(guard: WakeGuard, store: ObjectStore, audioPlayer: HTMLAudioElement, inputAudioLoader: HTMLInputElement, divInterface: HTMLDivElement, buttonAudioDrive: HTMLButtonElement, bPlaybackTime: HTMLElement, inputPlaybackTrack: HTMLInputElement): Promise<void> {
		this.#audioPlayer = audioPlayer;
		this.#store = store;
		this.#bPlaybackTime = bPlaybackTime;
		this.#inputPlaybackTrack = inputPlaybackTrack;

		audioPlayer.addEventListener("canplay", event => this.#markReady = true);
		audioPlayer.addEventListener("emptied", event => this.#markReady = false);
		audioPlayer.addEventListener("play", event => this.#markPlaying = true);
		audioPlayer.addEventListener("pause", event => this.#markPlaying = false);

		audioPlayer.addEventListener("canplay", event => guard.activate("playback"));
		audioPlayer.addEventListener("emptied", event => guard.deactivate("playback"));

		await this.#loadRecentAudio();
		bPlaybackTime.innerText = this.#toPlaytimeInfo(audioPlayer.currentTime);

		inputAudioLoader.addEventListener("input", async (event) => {
			try {
				const files = ReferenceError.suppress(inputAudioLoader.files, "Unable to read files list");
				const file = files.item(0);
				if (file === null) return;
				await this.#saveRecentAudio(file);
			} catch (reason) {
				await this.catch(Error.from(reason));
			} finally {
				bPlaybackTime.innerText = this.#toPlaytimeInfo(audioPlayer.currentTime);
				inputAudioLoader.value = String.empty;
			}
		});

		divInterface.addEventListener("click", async (event) => {
			if (audioPlayer.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
			event.stopImmediatePropagation();
			await this.#playToggle(audioPlayer.paused);
		});

		buttonAudioDrive.addEventListener("click", async (event) => {
			event.stopPropagation();
			if (audioPlayer.readyState === HTMLMediaElement.HAVE_NOTHING) inputAudioLoader.click();
			else await this.#saveRecentAudio(null);
		});

		audioPlayer.addEventListener("timeupdate", (event) => {
			if (this.#isSeeking) return;
			const factor = (audioPlayer.currentTime / audioPlayer.duration).insteadNaN(0);
			inputPlaybackTrack.value = `${factor * 100}`;
			inputPlaybackTrack.style.setProperty("--track-value", `${factor * 100}%`);
			bPlaybackTime.innerText = this.#toPlaytimeInfo(audioPlayer.currentTime);
		});
		inputPlaybackTrack.addEventListener("click", (event) => event.stopPropagation());
		inputPlaybackTrack.addEventListener("pointerdown", (event) => {
			event.stopPropagation();
			this.#isSeeking = true;
			inputPlaybackTrack.setPointerCapture(event.pointerId);
		});
		inputPlaybackTrack.addEventListener("pointerup", (event) => {
			event.stopPropagation();
			inputPlaybackTrack.releasePointerCapture(event.pointerId);
			this.#isSeeking = false;
			inputPlaybackTrack.blur();
		});
		inputPlaybackTrack.addEventListener("pointercancel", (event) => {
			event.stopPropagation();
			inputPlaybackTrack.releasePointerCapture(event.pointerId);
			this.#isSeeking = false;
		});

		inputPlaybackTrack.addEventListener("input", (event) => {
			if (audioPlayer.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
			this.#updateSeekTrack();
		});
		inputPlaybackTrack.addEventListener("change", (event) => {
			if (audioPlayer.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
			this.#updateSeekTrack();
			audioPlayer.currentTime = (audioPlayer.duration * this.#seekFactor()).insteadNaN(0);
		});

		window.addEventListener("keydown", async (event) => {
			if (event.code !== "Space") return;
			event.preventDefault();
			await this.#playToggle(audioPlayer.paused);
		});
	}
}
//#endregion
