"use strict";

import "adaptive-extender/core";
import { Deferred, Descendant, Field, Model } from "adaptive-extender/core";
import { NNWeights, type NNWeightsScheme } from "./nn-agent.js";

//#region Shared array buffer portable
class SharedArrayBufferPortable {
	static import(source: unknown, name: string): SharedArrayBuffer {
		if (source instanceof SharedArrayBuffer) return source;
		throw new TypeError(`${name} must be a SharedArrayBuffer`);
	}

	static export(source: SharedArrayBuffer): SharedArrayBuffer {
		return source;
	}
}
//#endregion

//#region Command
export interface CommandDiscriminator extends InitializeCommandDiscriminator, SaveWeightsCommandDiscriminator, LoadWeightsCommandDiscriminator, WeightsCommandDiscriminator, ResetCommandDiscriminator, FeedbackCommandDiscriminator, LearningCommandDiscriminator, ProgressCommandDiscriminator {
}

export interface CommandScheme {
	$type: keyof CommandDiscriminator;
}

@Descendant(Deferred(_ => InitializeCommand))
@Descendant(Deferred(_ => SaveWeightsCommand))
@Descendant(Deferred(_ => LoadWeightsCommand))
@Descendant(Deferred(_ => WeightsCommand))
@Descendant(Deferred(_ => ResetCommand))
@Descendant(Deferred(_ => FeedbackCommand))
@Descendant(Deferred(_ => LearningCommand))
@Descendant(Deferred(_ => ProgressCommand))
export abstract class Command extends Model {
	constructor() {
		super();
		if (new.target === Command) throw new TypeError("Unable to create an instance of an abstract class");
	}
}
//#endregion
//#region Initialize command
export interface InitializeCommandDiscriminator {
	"InitializeCommand": InitializeCommand;
}

export interface InitializeCommandScheme extends CommandScheme {
	$type: keyof InitializeCommandDiscriminator;
	in_sab: SharedArrayBuffer;
	out_sab: SharedArrayBuffer;
}

export class InitializeCommand extends Command {
	@Field(SharedArrayBufferPortable, { name: "in_sab" })
	inSAB: SharedArrayBuffer;

	@Field(SharedArrayBufferPortable, { name: "out_sab" })
	outSAB: SharedArrayBuffer;

	constructor();
	constructor(inSAB: SharedArrayBuffer, outSAB: SharedArrayBuffer);
	constructor(inSAB?: SharedArrayBuffer, outSAB?: SharedArrayBuffer) {
		if (inSAB === undefined || outSAB === undefined) {
			super();
			return;
		}

		super();
		this.inSAB = inSAB;
		this.outSAB = outSAB;
	}
}
//#endregion
//#region Save weights command
export interface SaveWeightsCommandDiscriminator {
	"SaveWeightsCommand": SaveWeightsCommand;
}

export interface SaveWeightsCommandScheme extends CommandScheme {
	$type: keyof SaveWeightsCommandDiscriminator;
}

export class SaveWeightsCommand extends Command {
}
//#endregion
//#region Load weights command
export interface LoadWeightsCommandDiscriminator {
	"LoadWeightsCommand": LoadWeightsCommand;
}

export interface LoadWeightsCommandScheme extends CommandScheme {
	$type: keyof LoadWeightsCommandDiscriminator;
	weights: NNWeightsScheme;
}

export class LoadWeightsCommand extends Command {
	@Field(NNWeights, { name: "weights" })
	weights: NNWeights;

	constructor();
	constructor(weights: NNWeights);
	constructor(weights?: NNWeights) {
		if (weights === undefined) {
			super();
			return;
		}

		super();
		this.weights = weights;
	}
}
//#endregion
//#region Weights command
export interface WeightsCommandDiscriminator {
	"WeightsCommand": WeightsCommand;
}

export interface WeightsCommandScheme extends CommandScheme {
	$type: keyof WeightsCommandDiscriminator;
	weights: NNWeightsScheme;
}

export class WeightsCommand extends Command {
	@Field(NNWeights, { name: "weights" })
	weights: NNWeights;

	constructor();
	constructor(weights: NNWeights);
	constructor(weights?: NNWeights) {
		if (weights === undefined) {
			super();
			return;
		}

		super();
		this.weights = weights;
	}
}
//#endregion
//#region Reset command
export interface ResetCommandDiscriminator {
	"ResetCommand": ResetCommand;
}

export interface ResetCommandScheme extends CommandScheme {
	$type: keyof ResetCommandDiscriminator;
}

export class ResetCommand extends Command {
}
//#endregion
//#region Feedback command
export interface FeedbackCommandDiscriminator {
	"FeedbackCommand": FeedbackCommand;
}

export interface FeedbackCommandScheme extends CommandScheme {
	$type: keyof FeedbackCommandDiscriminator;
	sign: number;
}

export class FeedbackCommand extends Command {
	@Field(Number, { name: "sign" })
	sign: number;

	constructor();
	constructor(sign: number);
	constructor(sign?: number) {
		if (sign === undefined) {
			super();
			return;
		}

		super();
		this.sign = sign;
	}
}
//#endregion
//#region Learning command
export interface LearningCommandDiscriminator {
	"LearningCommand": LearningCommand;
}

export interface LearningCommandScheme extends CommandScheme {
	$type: keyof LearningCommandDiscriminator;
	enabled: boolean;
}

export class LearningCommand extends Command {
	@Field(Boolean, { name: "enabled" })
	enabled: boolean;

	constructor();
	constructor(enabled: boolean);
	constructor(enabled?: boolean) {
		if (enabled === undefined) {
			super();
			return;
		}

		super();
		this.enabled = enabled;
	}
}
//#endregion
//#region Progress command
export interface ProgressCommandDiscriminator {
	"ProgressCommand": ProgressCommand;
}

export interface ProgressCommandScheme extends CommandScheme {
	$type: keyof ProgressCommandDiscriminator;
	count: number;
}

export class ProgressCommand extends Command {
	@Field(Number, { name: "count" })
	count: number;

	constructor();
	constructor(count: number);
	constructor(count?: number) {
		if (count === undefined) {
			super();
			return;
		}

		super();
		this.count = count;
	}
}
//#endregion
