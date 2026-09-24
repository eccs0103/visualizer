"use strict";

import "adaptive-extender/core";
import { BackgroundEffectKind } from "../models/background-settings.js";
import { type StageHost } from "../models/visualization.js";

//#region Placement
export class Placement {
	x: number = 0;
	y: number = 0;
	scale: number = 1;

	reset(): void {
		this.x = 0;
		this.y = 0;
		this.scale = 1;
	}

	clamp(width: number, height: number, overscan: number): void {
		const enlarged = this.scale * (1 + overscan);
		const xLimit = (enlarged - 1) * width / 2;
		const yLimit = (enlarged - 1) * height / 2;
		this.x = this.x.clamp(-xLimit, xLimit);
		this.y = this.y.clamp(-yLimit, yLimit);
	}
}
//#endregion
//#region Background effect
export abstract class BackgroundEffect {
	abstract place(stage: StageHost, intensity: number, placement: Placement): void;
}
//#endregion
//#region No effect
class NoEffect extends BackgroundEffect {
	place(stage: StageHost, intensity: number, placement: Placement): void {
		void stage, intensity, placement;
	}
}
//#endregion
//#region Shake effect
class ShakeEffect extends BackgroundEffect {
	static #gain: number = 4;

	place(stage: StageHost, intensity: number, placement: Placement): void {
		const { camera } = stage;
		const factor = intensity * ShakeEffect.#gain;
		placement.x = camera.e * factor;
		placement.y = camera.f * factor;
		placement.scale = 1 + (camera.a - 1) * intensity;
	}
}
//#endregion
//#region Pulse effect
class PulseEffect extends BackgroundEffect {
	static #decay: number = 4;
	#energy: number = 0;

	place(stage: StageHost, intensity: number, placement: Placement): void {
		const { audioset, environment } = stage;
		const { delta } = environment;
		let energy = this.#energy;
		if (Number.isFinite(delta)) energy = (energy - delta * PulseEffect.#decay).clamp(0, 1);
		if (audioset.beatDetected) energy = 1;
		this.#energy = energy;
		const level = energy * 0.6 + audioset.bassLevel.clamp(0, 0.6).lerp(0, 0.6, 0, 1) * 0.4;
		placement.scale = 1 + intensity * level * 0.08;
	}
}
//#endregion
//#region Parallax effect
class ParallaxEffect extends BackgroundEffect {
	static #gain: number = 4;

	place(stage: StageHost, intensity: number, placement: Placement): void {
		const { camera } = stage;
		const factor = intensity * ParallaxEffect.#gain;
		placement.x = -camera.e * factor;
		placement.y = -camera.f * factor;
	}
}
//#endregion
//#region Background effects
export class BackgroundEffects {
	static create(kind: BackgroundEffectKind): BackgroundEffect {
		switch (kind) {
		case BackgroundEffectKind.none: return new NoEffect();
		case BackgroundEffectKind.shake: return new ShakeEffect();
		case BackgroundEffectKind.pulse: return new PulseEffect();
		case BackgroundEffectKind.parallax: return new ParallaxEffect();
		default: throw new Error(`Invalid '${kind}' effect`);
		}
	}
}
//#endregion
