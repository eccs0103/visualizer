"use strict";

import "adaptive-extender/web";
import { Timespan } from "adaptive-extender/web";
import { ChunkCommand, ClipCommand, DoneCommand, FinishCommand } from "../models/clip-commands.js";

const { baseURI } = document;

//#region Clip file
export class ClipFile {
	#blob: Blob;
	#url: string;
	#name: string;

	constructor(blob: Blob, url: string, name: string) {
		this.#blob = blob;
		this.#url = url;
		this.#name = name;
	}

	get blob(): Blob { return this.#blob; }
	get url(): string { return this.#url; }
	get name(): string { return this.#name; }

	static #makeName(type: string): string {
		const date = new Date().toISOString().replaceAll(":", "-");
		const extension = type.includes("webm") ? "webm" : "bin";
		return `visualizer-${date}.${extension}`;
	}

	static from(blob: Blob): ClipFile {
		const url = URL.createObjectURL(blob);
		return new ClipFile(blob, url, ClipFile.#makeName(blob.type));
	}

	download(): void {
		const link = document.createElement("a");
		link.href = this.#url;
		link.download = this.#name;
		link.click();
		link.remove();
	}

	revoke(): void {
		URL.revokeObjectURL(this.#url);
	}
}
//#endregion
//#region Clip session
class ClipSession {
	static #types: readonly string[] = Object.freeze([
		"video/webm;codecs=vp9,opus",
		"video/webm;codecs=vp8,opus",
		"video/webm;codecs=vp9",
		"video/webm;codecs=vp8",
		"video/webm"
	]);

	#worker: Worker = new Worker(new URL("./services/clip-accumulator-worker.js", baseURI), { type: "module" });
	#recorder: MediaRecorder;
	#streamVideo: MediaStream;
	#streamAudio: MediaStream;
	#trackVideo: CanvasCaptureMediaStreamTrack | null;

	constructor(recorder: MediaRecorder, streamVideo: MediaStream, streamAudio: MediaStream) {
		this.#recorder = recorder;
		this.#streamVideo = streamVideo;
		this.#streamAudio = streamAudio;

		const tracksVideo = streamVideo.getVideoTracks();
		if (tracksVideo.length < 1) return;
		const trackVideo = tracksVideo[0];
		if (!(trackVideo instanceof CanvasCaptureMediaStreamTrack)) return;
		this.#trackVideo = trackVideo;
	}

	static #pickType(): string | null {
		for (const type of ClipSession.#types) {
			if (!MediaRecorder.isTypeSupported(type)) continue;
			return type;
		}
		return null;
	}

	static #captureAudioStream(media: HTMLMediaElement): MediaStream {
		if ("captureStream" in media && typeof media.captureStream === "function") return media.captureStream();
		throw new Error("Audio stream capture is not supported by this browser");
	}

	static create(canvas: HTMLCanvasElement, media: HTMLMediaElement): ClipSession {
		const mimeType = ClipSession.#pickType();
		if (mimeType === null) throw new Error("No supported WebM encoder is available in this browser");

		const streamVideo = canvas.captureStream();
		const tracksVideo = streamVideo.getVideoTracks();

		const streamAudio = ClipSession.#captureAudioStream(media);
		const tracksAudio = streamAudio.getAudioTracks();

		const stream = new MediaStream([...tracksVideo, ...tracksAudio]);
		const videoBitsPerSecond = 12_000_000;
		const audioBitsPerSecond = 192_000;
		const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond, audioBitsPerSecond });

		return new ClipSession(recorder, streamVideo, streamAudio);
	}

	begin(): void {
		const recorder = this.#recorder;
		const worker = this.#worker;
		recorder.addEventListener("dataavailable", (event) => {
			const { data } = event;
			if (data.size < 1) return;
			worker.postMessage(ClipCommand.export(new ChunkCommand(data)));
		});
		recorder.start();
	}

	capture(): void {
		this.#trackVideo?.requestFrame();
	}

	finish(): Promise<ClipFile> {
		const recorder = this.#recorder;
		const worker = this.#worker;

		return Promise.withSignal<ClipFile>((signal, resolve, reject) => {
			worker.addEventListener("message", (event: MessageEvent) => {
				try {
					const command = ClipCommand.import(event.data, "command");
					if (!(command instanceof DoneCommand)) return;
					resolve(ClipFile.from(command.blob));
				} catch (reason) {
					reject(reason);
				}
			}, { signal });
			worker.addEventListener("error", event => reject(new Error(event.message)), { signal });
			recorder.addEventListener("stop", event => worker.postMessage(ClipCommand.export(new FinishCommand(recorder.mimeType))), { signal });
			recorder.addEventListener("error", event => reject(event.error ?? event.message), { signal });
			recorder.stop();
		});
	}

	dispose(): void {
		this.#worker.terminate();
		this.#streamVideo.getTracks().forEach(track => track.stop());
		this.#streamAudio.getTracks().forEach(track => track.stop());
	}
}
//#endregion
//#region Clip recorder
export interface ClipRecorderEventMap {
	"start": Event;
	"stop": CustomEvent<ClipFile>;
	"tick": CustomEvent<Timespan>;
}

export class ClipRecorder extends EventTarget {
	#canvas: HTMLCanvasElement;
	#media: HTMLMediaElement;
	#session: ClipSession | null = null;
	#timeBegin: number = 0;

	constructor(canvas: HTMLCanvasElement, media: HTMLMediaElement) {
		super();
		this.#canvas = canvas;
		this.#media = media;
	}

	addEventListener<K extends keyof ClipRecorderEventMap>(type: K, listener: (this: Document, event: ClipRecorderEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		return super.addEventListener(type, listener, options);
	};

	removeEventListener<K extends keyof ClipRecorderEventMap>(type: K, listener: (this: Document, event: ClipRecorderEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		return super.removeEventListener(type, listener, options);
	}

	get isRecording(): boolean {
		return this.#session !== null;
	}

	async start(): Promise<void> {
		if (this.isRecording) throw new Error("Recording has already started");
		const session = ClipSession.create(this.#canvas, this.#media);
		try {
			session.begin();
		} catch (reason) {
			session.dispose();
			throw Error.from(reason);
		}
		this.#session = session;
		this.#timeBegin = performance.now();
		this.dispatchEvent(new Event("start"));
	}

	tick(): void {
		const session = this.#session;
		if (session === null) return;
		session.capture();
		const detail = Timespan.fromValue(performance.now() - this.#timeBegin);
		this.dispatchEvent(new CustomEvent("tick", { detail }));
	}

	async stop(): Promise<ClipFile> {
		const session = this.#session;
		if (session === null) throw new Error("Recording has not started");
		this.#session = null;
		const file = await session.finish();
		session.dispose();
		this.dispatchEvent(new CustomEvent("stop", { detail: file }));
		return file;
	}
}
//#endregion
