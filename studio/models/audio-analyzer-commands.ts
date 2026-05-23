"use strict";

import "adaptive-extender/core";
import { Deferred, Descendant, Field, Model } from "adaptive-extender/core";
import { type NNWeights, type NNWeightsSceme } from "./nn-agent.js";

class SharedArrayBufferPortable {
	static import(source: unknown, name: string): SharedArrayBuffer {
		if (source instanceof SharedArrayBuffer) return source;
		throw new TypeError(`${name} must be a SharedArrayBuffer`);
	}

	static export(source: SharedArrayBuffer): SharedArrayBuffer {
		return source;
	}
}

//#region Command
export interface CommandDiscriminator extends InitializeCommandDiscriminator, TrainCommandDiscriminator, SaveWeightsCommandDiscriminator, LoadWeightsCommandDiscriminator, WeightsCommandDiscriminator, SetAutoTrainCommandDiscriminator, ResetCommandDiscriminator, AutoProgressCommandDiscriminator {
}

export interface CommandScheme {
	$type: keyof CommandDiscriminator;
	platform: string;
	timestamp: number;
}

@Descendant(Deferred(_ => InitializeCommand))
@Descendant(Deferred(_ => TrainCommand))
@Descendant(Deferred(_ => SaveWeightsCommand))
@Descendant(Deferred(_ => LoadWeightsCommand))
@Descendant(Deferred(_ => WeightsCommand))
@Descendant(Deferred(_ => SetAutoTrainCommand))
@Descendant(Deferred(_ => ResetCommand))
@Descendant(Deferred(_ => AutoProgressCommand))
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
	inSAB: SharedArrayBuffer;
	outSAB: SharedArrayBuffer;
}

export class InitializeCommand extends Command {
	@Field(SharedArrayBufferPortable)
	inSAB: SharedArrayBuffer;

	@Field(SharedArrayBufferPortable)
	outSAB: SharedArrayBuffer;

	constructor();
	constructor(inSAB: SharedArrayBuffer, outSAB: SharedArrayBuffer);
	constructor(inSAB?: SharedArrayBuffer, outSAB?: SharedArrayBuffer) {
		super();
		Object.assign(this, { inSAB, outSAB });
	}
}
//#endregion
//#region Train command
export interface TrainCommandDiscriminator {
	"TrainCommand": TrainCommand;
}

export interface TrainCommandScheme extends CommandScheme {
	$type: keyof TrainCommandDiscriminator;
	label: number;
}

export class TrainCommand extends Command {
	@Field(Number)
	label: number;

	constructor();
	constructor(label: number);
	constructor(label?: number) {
		super();
		Object.assign(this, { label });
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
	weights: NNWeightsSceme;
}

export class LoadWeightsCommand extends Command {
	@Field(Object)
	weights: NNWeights;

	constructor();
	constructor(weights: NNWeights);
	constructor(weights?: NNWeights) {
		super();
		Object.assign(this, { weights });
	}

}
//#endregion
//#region Weights command
export interface WeightsCommandDiscriminator {
	"WeightsCommand": WeightsCommand;
}

export interface WeightsCommandScheme extends CommandScheme {
	$type: keyof WeightsCommandDiscriminator;
	weights: NNWeightsSceme;
}

export class WeightsCommand extends Command {
	@Field(Object)
	weights: NNWeights;

	constructor();
	constructor(weights: NNWeights);
	constructor(weights?: NNWeights) {
		super();
		Object.assign(this, { weights });
	}

}
//#endregion
//#region Set auto train command
export interface SetAutoTrainCommandDiscriminator {
	"SetAutoTrainCommand": SetAutoTrainCommand;
}

export interface SetAutoTrainCommandScheme extends CommandScheme {
	$type: keyof SetAutoTrainCommandDiscriminator;
	enabled: boolean;
}

export class SetAutoTrainCommand extends Command {
	@Field(Boolean)
	enabled: boolean;

	constructor();
	constructor(enabled: boolean);
	constructor(enabled?: boolean) {
		super();
		Object.assign(this, { enabled });
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
//#region Auto progress command
export interface AutoProgressCommandDiscriminator {
	"AutoProgressCommand": AutoProgressCommand;
}

export interface AutoProgressCommandScheme extends CommandScheme {
	$type: keyof AutoProgressCommandDiscriminator;
	count: number;
}

export class AutoProgressCommand extends Command {
	@Field(Number)
	count: number;

	constructor();
	constructor(count: number);
	constructor(count?: number) {
		super();
		Object.assign(this, { count });
	}

}
//#endregion
