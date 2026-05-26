"use strict";

import "adaptive-extender/web";
import { Timespan } from "adaptive-extender/web";

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

	#recorder: MediaRecorder;
	#streamVideo: MediaStream;
	#streamAudio: MediaStream;
	#trackVideo: CanvasCaptureMediaStreamTrack;
	#chunks: Blob[] = [];

	constructor(recorder: MediaRecorder, streamVideo: MediaStream, streamAudio: MediaStream, trackVideo: CanvasCaptureMediaStreamTrack) {
		this.#recorder = recorder;
		this.#streamVideo = streamVideo;
		this.#streamAudio = streamAudio;
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
		if ("mozCaptureStream" in media && typeof media.mozCaptureStream === "function") return media.mozCaptureStream();
		throw new Error("Audio stream capture is not supported by this browser");
	}

	static create(canvas: HTMLCanvasElement, media: HTMLMediaElement): ClipSession {
		const mimeType = ClipSession.#pickType();
		if (mimeType === null) throw new Error("No supported WebM encoder is available in this browser");

		const streamVideo = canvas.captureStream(0);
		const tracksVideo = streamVideo.getVideoTracks();
		if (tracksVideo.length < 1) throw new Error("Unable to acquire video tracks from canvas stream");

		const trackVideo = tracksVideo[0];
		if (!(trackVideo instanceof CanvasCaptureMediaStreamTrack)) throw new Error("Unable to acquire video track from canvas stream");

		const streamAudio = ClipSession.#captureAudioStream(media);
		const tracksAudio = streamAudio.getAudioTracks();
		if (tracksAudio.length < 1) throw new Error("No audio track found in media stream. Start playback and try again");

		const stream = new MediaStream([...tracksVideo, ...tracksAudio]);
		const videoBitsPerSecond = 12_000_000;
		const audioBitsPerSecond = 192_000;
		const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond, audioBitsPerSecond });

		return new ClipSession(recorder, streamVideo, streamAudio, trackVideo);
	}

	begin(): void {
		const recorder = this.#recorder;
		const chunks = this.#chunks;
		recorder.addEventListener("dataavailable", (event) => {
			const { data } = event;
			if (data.size < 1) return;
			chunks.push(data);
		});
		recorder.start();
	}

	capture(): void {
		this.#trackVideo.requestFrame();
	}

	finish(): Promise<ClipFile> {
		const recorder = this.#recorder;
		const chunks = this.#chunks;

		return Promise.withSignal<ClipFile>((signal, resolve, reject) => {
			recorder.addEventListener("stop", (event) => {
				try {
					const type = recorder.mimeType;
					resolve(ClipFile.from(new Blob(chunks, { type })));
				} catch (reason) {
					reject(Error.from(reason));
				}
			}, { signal });
			recorder.addEventListener("error", event => reject(event.error ?? event.message), { signal });
			recorder.stop();
		});
	}

	dispose(): void {
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
