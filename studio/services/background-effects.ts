"use strict";

import "adaptive-extender/core";
import { BackgroundEffectKind } from "../models/background-settings.js";
import { type StageHost } from "../models/visualization.js";

const gain = 4;
const decay = 4;

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
		const limitX = (enlarged - 1) * width / 2;
		const limitY = (enlarged - 1) * height / 2;
		this.x = this.x.clamp(-limitX, limitX);
		this.y = this.y.clamp(-limitY, limitY);
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
	place(stage: StageHost, intensity: number, placement: Placement): void {
		const { camera } = stage;
		const factor = intensity * gain;
		placement.x = camera.e * factor;
		placement.y = camera.f * factor;
		placement.scale = 1 + (camera.a - 1) * intensity;
	}
}
//#endregion
//#region Pulse effect
class PulseEffect extends BackgroundEffect {
	#energy: number = 0;

	place(stage: StageHost, intensity: number, placement: Placement): void {
		const { audioset, environment } = stage;
		const { delta } = environment;
		if (Number.isFinite(delta)) this.#energy = (this.#energy - delta * decay).clamp(0, 1);
		if (audioset.beatDetected) this.#energy = 1;
		const level = this.#energy * 0.6 + audioset.bassLevel.clamp(0, 0.6).lerp(0, 0.6, 0, 1) * 0.4;
		placement.scale = 1 + intensity * level * 0.08;
	}
}
//#endregion
//#region Parallax effect
class ParallaxEffect extends BackgroundEffect {
	place(stage: StageHost, intensity: number, placement: Placement): void {
		const { camera } = stage;
		const factor = intensity * gain;
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
