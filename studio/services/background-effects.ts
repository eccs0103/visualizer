"use strict";

import "adaptive-extender/worker";
import { Random, Vector2D } from "adaptive-extender/worker";
import { BackgroundEffectKind } from "../models/layer-settings.js";
import { type Stage } from "./stage.js";

const { min, sqrt, sin, cos, PI } = Math;
const random = Random.global;

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
	static #limit: number = 0.05;

	static elapsed(delta: number): number {
		if (!Number.isFinite(delta)) return 0;
		return delta.clamp(0, BackgroundEffect.#limit);
	}

	static create(kind: BackgroundEffectKind): BackgroundEffect {
		switch (kind) {
		case BackgroundEffectKind.none: return new NoEffect();
		case BackgroundEffectKind.shake: return new ShakeEffect();
		case BackgroundEffectKind.pulse: return new PulseEffect();
		case BackgroundEffectKind.parallax: return new ParallaxEffect();
		default: throw new TypeError(`Invalid '${kind}' effect`);
		}
	}

	abstract place(stage: Stage, intensity: number, placement: Placement): void;
}
//#endregion
//#region No effect
class NoEffect extends BackgroundEffect {
	place(stage: Stage, intensity: number, placement: Placement): void {
		void stage, intensity, placement;
	}
}
//#endregion
//#region Shake effect
class ShakeEffect extends BackgroundEffect {
	static #reach: number = 0.04;
	static #stiffness: number = 400;
	static #damping: number = 22;
	static #zoom: number = 0.03;
	static #decay: number = 10;
	#offset: Vector2D = Vector2D.newZero;
	#velocity: Vector2D = Vector2D.newZero;
	#energy: number = 0;
	#isBeat: boolean = false;

	#kick(stage: Stage, intensity: number): void {
		const { width, height, dropIntensity } = stage;
		const reach = ShakeEffect.#reach * min(width, height) * intensity * (0.5 + 0.5 * dropIntensity.clamp(0, 1));
		const speed = reach * sqrt(ShakeEffect.#stiffness);
		const angle = random.number(0, 2 * PI);
		const velocity = this.#velocity;
		velocity.x = cos(angle) * speed;
		velocity.y = sin(angle) * speed;
		this.#energy = 1;
	}

	#settle(elapsed: number): void {
		const offset = this.#offset;
		const velocity = this.#velocity;
		const stiffness = ShakeEffect.#stiffness;
		const damping = ShakeEffect.#damping;
		velocity.x -= (stiffness * offset.x + damping * velocity.x) * elapsed;
		velocity.y -= (stiffness * offset.y + damping * velocity.y) * elapsed;
		offset.x += velocity.x * elapsed;
		offset.y += velocity.y * elapsed;
		this.#energy = (this.#energy - elapsed * ShakeEffect.#decay).clamp(0, 1);
	}

	place(stage: Stage, intensity: number, placement: Placement): void {
		const { beatDetected } = stage;
		if (beatDetected && !this.#isBeat) this.#kick(stage, intensity);
		this.#isBeat = beatDetected;
		this.#settle(BackgroundEffect.elapsed(stage.delta));
		const offset = this.#offset;
		placement.x = offset.x;
		placement.y = offset.y;
		placement.scale = 1 + intensity * this.#energy * ShakeEffect.#zoom;
	}
}
//#endregion
//#region Pulse effect
class PulseEffect extends BackgroundEffect {
	static #decay: number = 4;
	#energy: number = 0;

	place(stage: Stage, intensity: number, placement: Placement): void {
		const { delta } = stage;
		let energy = this.#energy;
		if (Number.isFinite(delta)) energy = (energy - delta * PulseEffect.#decay).clamp(0, 1);
		if (stage.beatDetected) energy = 1;
		this.#energy = energy;
		const level = energy * 0.6 + stage.bassLevel.clamp(0, 0.6).lerp(0, 0.6, 0, 1) * 0.4;
		placement.scale = 1 + intensity * level * 0.08;
	}
}
//#endregion
//#region Parallax effect
class ParallaxEffect extends BackgroundEffect {
	static #reach: number = 0.035;
	static #calm: number = 0.35;
	static #pace: number = 0.3;
	static #surge: number = 2.7;
	static #ease: number = 3;
	static #depth: number = 0.05;
	static #ratio: number = 0.71;
	static #shift: number = 1.3;
	static #ceiling: number = 0.6;
	#phase: number = 0;
	#level: number = 0;

	place(stage: Stage, intensity: number, placement: Placement): void {
		const { delta, bassLevel, width, height } = stage;
		const elapsed = BackgroundEffect.elapsed(delta);
		const ceiling = ParallaxEffect.#ceiling;
		const energy = bassLevel.clamp(0, ceiling).lerp(0, ceiling, 0, 1);
		let level = this.#level;
		level += (energy - level) * min(1, elapsed * ParallaxEffect.#ease);
		this.#level = level;
		const phase = this.#phase + elapsed * (ParallaxEffect.#pace + level * ParallaxEffect.#surge);
		this.#phase = phase;
		const calm = ParallaxEffect.#calm;
		const reach = ParallaxEffect.#reach * intensity * (calm + (1 - calm) * level);
		placement.x = sin(phase) * reach * width;
		placement.y = sin(phase * ParallaxEffect.#ratio + ParallaxEffect.#shift) * reach * height;
		placement.scale = 1 + intensity * level * ParallaxEffect.#depth;
	}
}
//#endregion
