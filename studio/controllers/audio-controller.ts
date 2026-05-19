"use strict";

import "adaptive-extender/web";
import { Controller, Timespan } from "adaptive-extender/web";
import { ObjectStore } from "../services/object-store.js";

//#region Audio controller
export class AudioController extends Controller<[store: ObjectStore, player: HTMLAudioElement, loader: HTMLInputElement, panel: HTMLDivElement, drive: HTMLButtonElement, timeLabel: HTMLElement, seekRange: HTMLInputElement]> {
	#player: HTMLAudioElement;
	#store: ObjectStore;
	#timeLabel: HTMLElement;
	#seekRange: HTMLInputElement;

	get #markReady(): boolean { return this.#player.dataset["ready"] !== undefined; }
	set #markReady(value: boolean) {
		const dataset = this.#player.dataset;
		if (value) dataset["ready"] = String.empty;
		else delete dataset["ready"];
	}

	get #markPlaying(): boolean { return this.#player.dataset["playing"] !== undefined; }
	set #markPlaying(value: boolean) {
		if (!this.#markReady) return;
		const dataset = this.#player.dataset;
		if (value) dataset["playing"] = String.empty;
		else delete dataset["playing"];
	}

	async #playToggle(value: boolean): Promise<void> {
		const player = this.#player;
		if (value) await player.play();
		else player.pause();
	}

	static #toPlaytimeString(seconds: number): string {
		const time = Timespan.fromComponents(0, 0, seconds);
		const minute = time.days * 24 + time.hours * 60 + time.minutes;
		const second = time.seconds;
		return `${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`;
	}

	#toPlaytimeInfo(seconds: number): string {
		const player = this.#player;
		const current = AudioController.#toPlaytimeString(seconds);
		if (Number.isNaN(player.duration)) return current;
		return `${current} • ${AudioController.#toPlaytimeString(player.duration)}`;
	}

	async #loadAudio(file: File): Promise<void> {
		const player = this.#player;
		await Promise.withSignal((signal, resolve, reject) => {
			player.addEventListener("canplay", event => resolve(), { signal });
			player.addEventListener("error", event => reject(new Error("Failed to load audio file")), { signal });
			player.src = URL.createObjectURL(file);
		});
	}

	#dropAudio(): void {
		const player = this.#player;
		player.removeAttribute("src");
		player.srcObject = null;
	}

	async #loadRecentAudio(): Promise<void> {
		const file = await this.#store.get(0);
		if (file === undefined || !(file instanceof File)) return;
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
		const { value, min, max } = this.#seekRange;
		return Number(value).lerp(Number(min), Number(max));
	}

	async run(store: ObjectStore, player: HTMLAudioElement, loader: HTMLInputElement, panel: HTMLDivElement, drive: HTMLButtonElement, timeLabel: HTMLElement, seekRange: HTMLInputElement): Promise<void> {
		this.#player = player;
		this.#store = store;
		this.#timeLabel = timeLabel;
		this.#seekRange = seekRange;

		player.addEventListener("canplay", event => this.#markReady = true);
		player.addEventListener("emptied", event => this.#markReady = false);
		player.addEventListener("play", event => this.#markPlaying = true);
		player.addEventListener("pause", event => this.#markPlaying = false);

		await this.#loadRecentAudio();
		timeLabel.innerText = this.#toPlaytimeInfo(player.currentTime);

		loader.addEventListener("input", async (event) => {
			try {
				const files = ReferenceError.suppress(loader.files, "Unable to read files list");
				const file = files.item(0);
				if (file === null) return;
				await this.#saveRecentAudio(file);
			} catch (reason) {
				await this.catch(Error.from(reason));
			} finally {
				timeLabel.innerText = this.#toPlaytimeInfo(player.currentTime);
				loader.value = String.empty;
			}
		});

		panel.addEventListener("click", async (event) => {
			if (player.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
			event.stopImmediatePropagation();
			await this.#playToggle(player.paused);
		});

		drive.addEventListener("click", async (event) => {
			event.stopPropagation();
			if (player.readyState === HTMLMediaElement.HAVE_NOTHING) loader.click();
			else await this.#saveRecentAudio(null);
		});

		player.addEventListener("timeupdate", (event) => {
			if (document.activeElement === seekRange) return;
			const factor = (player.currentTime / player.duration).insteadNaN(0);
			seekRange.value = `${factor * 100}`;
			seekRange.style.setProperty("--track-value", `${factor * 100}%`);
			timeLabel.innerText = this.#toPlaytimeInfo(player.currentTime);
		});
		seekRange.addEventListener("pointerup", (event) => seekRange.blur());

		const updateSeekTrack = (): void => {
			const factor = this.#seekFactor();
			seekRange.style.setProperty("--track-value", `${factor * 100}%`);
			const time = (player.duration * factor).insteadNaN(0);
			timeLabel.innerText = this.#toPlaytimeInfo(time);
		};
		seekRange.addEventListener("input", (event) => {
			if (player.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
			updateSeekTrack();
		});
		seekRange.addEventListener("change", (event) => {
			if (player.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) return;
			updateSeekTrack();
			player.currentTime = (player.duration * this.#seekFactor()).insteadNaN(0);
		});

		window.addEventListener("keydown", async (event) => {
			if (event.code !== "Space") return;
			event.preventDefault();
			await this.#playToggle(player.paused);
		});
	}

	async catch(error: Error): Promise<void> {
		const message = `${error}\n\nAn error occurred. Any further actions may result in errors. To prevent this from happening, would you like to reload?`;
		if (window.confirm(message)) location.reload();
	}
}
//#endregion
