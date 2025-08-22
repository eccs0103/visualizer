"use strict";

import "adaptive-extender/web";
import { Engine, FastEngine } from "adaptive-extender/web";

//#region Visualization configuration
interface VisualizationConfigurationNotation {
	quality?: number;
	smoothing?: number;
	focus?: number;
	spread?: number;
}

class VisualizationConfiguration {
	/**
	 * @param {any} source 
	 * @param {string} name 
	 * @returns {VisualizationConfiguration}
	 */
	static import(source: any, name: string = "source"): VisualizationConfiguration {
		try {
			const shell = Object.import(source);
			const configuration = new VisualizationConfiguration();
			const quality = Reflect.get(shell, "quality");
			if (quality !== undefined) {
				configuration.quality = Number.import(quality, "property quality");
			}
			const smoothing = Reflect.get(shell, "smoothing");
			if (smoothing !== undefined) {
				configuration.smoothing = Number.import(smoothing, "property smoothing");
			}
			const focus = Reflect.get(shell, "focus");
			if (focus !== undefined) {
				configuration.focus = Number.import(focus, "property focus");
			}
			const spread = Reflect.get(shell, "spread");
			if (spread !== undefined) {
				configuration.spread = Number.import(spread, "property spread");
			}
			return configuration;
		} catch (cause) {
			throw new TypeError("Unable to import ${(name)} due its ${typename(source)} type", { cause });
		}
	}
	/**
	 * @returns {VisualizationConfigurationNotation}
	 */
	export(): VisualizationConfigurationNotation {
		return {
			quality: this.#quality,
			smoothing: this.#smoothing,
			focus: this.#focus,
			spread: this.#spread,
		};
	}
	/** @type {number} */
	#quality: number = 10;
	/**
	 * @returns {number}
	 */
	get quality(): number {
		return this.#quality;
	}
	/**
	 * @param {number} value 
	 * @returns {void}
	 */
	set quality(value: number): void {
		if (!Audioset.Manager.checkQuality(value)) throw new Error("Invalid value '${value}' for quality");
		this.#quality = value;
	}
	/** @type {number} */
	#smoothing: number = 0.7;
	/**
	 * @returns {number}
	 */
	get smoothing(): number {
		return this.#smoothing;
	}
	/**
	 * @param {number} value 
	 * @returns {void}
	 */
	set smoothing(value: number): void {
		if (!Audioset.Manager.checkSmoothing(value)) throw new Error("Invalid value '${value}' for smoothing");
		this.#smoothing = value;
	}
	/** @type {number} */
	#focus: number = -65;
	/**
	 * @returns {number}
	 */
	get focus(): number {
		return this.#focus;
	}
	/**
	 * @param {number} value 
	 * @returns {void}
	 */
	set focus(value: number): void {
		if (!Audioset.Manager.checkFocus(value)) throw new Error("Invalid value '${value}' for focus");
		this.#focus = value;
	}
	/** @type {number} */
	#spread: number = 35;
	/**
	 * @returns {number}
	 */
	get spread(): number {
		return this.#spread;
	}
	/**
	 * @param {number} value 
	 * @returns {void}
	 */
	set spread(value: number): void {
		if (!Audioset.Manager.checkSpread(value)) throw new Error("Invalid value '${value}' for spread");
		this.#spread = value;
	}
}
//#endregion
//#region Visualization attachment
type VisualizationAttachmentNotation = [string, VisualizationConfigurationNotation];

class VisualizationAttachment {
	/**
	 * @param {any} source 
	 * @param {string} name 
	 * @returns {VisualizationAttachment}
	 */
	static import(source: any, name: string = "source"): VisualizationAttachment {
		try {
			const shell = Array.import(source);
			const name = String.import(shell[0], "property name");
			const configuration = VisualizationConfiguration.import(shell[1], "property configuration");
			return new VisualizationAttachment(name, configuration);
		} catch (cause) {
			throw new TypeError("Unable to import ${(name)} due its ${typename(source)} type", { cause });
		}
	}
	/**
	 * @returns {VisualizationAttachmentNotation}
	 */
	export(): VisualizationAttachmentNotation {
		return [
			this.#name,
			this.#configuration.export()
		];
	}
	/**
	 * @param {Readonly<[string, VisualizationConfiguration]>} source 
	 * @returns {VisualizationAttachment}
	 */
	static fromArray(source: Readonly<[string, VisualizationConfiguration]>): VisualizationAttachment {
		const [name, configuration] = source;
		return new VisualizationAttachment(name, configuration);
	}
	/**
	 * @returns {[string, VisualizationConfiguration]}
	 */
	toArray(): [string, VisualizationConfiguration] {
		return [this.#name, this.#configuration];
	}
	/**
	 * @param {string} name 
	 * @param {VisualizationConfiguration} configuration 
	 */
	constructor(name: string, configuration: VisualizationConfiguration) {
		this.#name = name;
		this.#configuration = configuration;
	}
	/** @type {string} */
	#name: string;
	/**
	 * @readonly
	 * @returns {string}
	 */
	get name(): string {
		return this.#name;
	}
	/** @type {VisualizationConfiguration} */
	#configuration: VisualizationConfiguration;
	/**
	 * @readonly
	 * @returns {VisualizationConfiguration}
	 */
	get configuration(): VisualizationConfiguration {
		return this.#configuration;
	}
}
//#endregion
//#region Visualizer configuration
interface VisualizerConfigurationNotation {
	rate?: number;
	autocorrect?: boolean;
	visualization?: string;
	attachments?: VisualizationAttachmentNotation[];
}

class VisualizerConfiguration {
	/**
	 * @param {any} source 
	 * @param {string} name 
	 * @returns {VisualizerConfiguration}
	 */
	static import(source: any, name: string = "source"): VisualizerConfiguration {
		try {
			const shell = Object.import(source);
			const result = new VisualizerConfiguration();
			const rate = Reflect.get(shell, "rate");
			if (rate !== undefined) {
				result.rate = Number.import(rate, "property rate");
			}
			const autocorrect = Reflect.get(shell, "autocorrect");
			if (autocorrect !== undefined) {
				result.autocorrect = Boolean.import(autocorrect, "property autocorrect");
			}
			const visualization = Reflect.get(shell, "visualization");
			if (visualization !== undefined) {
				result.visualization = String.import(visualization, "property visualization");
			}
			const attachments = Reflect.get(shell, "attachments");
			if (attachments !== undefined) {
				const mapping = new Map(Array.import(attachments, "property attachments").map((item, index) => VisualizationAttachment.import(item, "property attachments[${(index)}]").toArray()));
				result.#mapping = new Map(Visualizer.visualizations.map(name => [name, mapping.get(name) ?? new VisualizationConfiguration()]));
			}
			return result;
		} catch (cause) {
			throw new TypeError("Unable to import ${(name)} due its ${typename(source)} type", { cause });
		}
	}
	/**
	 * @returns {VisualizerConfigurationNotation}
	 */
	export(): VisualizerConfigurationNotation {
		return {
			rate: this.#rate,
			autocorrect: this.#autocorrect,
			visualization: this.#visualization,
			attachments: Array.from(this.#mapping).map(attachment => VisualizationAttachment.fromArray(attachment).export())
		};
	};
	/** @type {number} */
	#rate: number = 120;
	/**
	 * @returns {number}
	 */
	get rate(): number {
		return this.#rate;
	}
	/**
	 * @param {number} value 
	 * @returns {void}
	 */
	set rate(value: number): void {
		if (!Visualizer.checkRate(value)) throw new Error("Invalid value '${value}' for rate");
		this.#rate = value;
	}
	/** @type {boolean} */
	#autocorrect: boolean = false;
	/**
	 * @returns {boolean}
	 */
	get autocorrect(): boolean {
		return this.#autocorrect;
	}
	/**
	 * @param {boolean} value 
	 * @returns {void}
	 */
	set autocorrect(value: boolean): void {
		this.#autocorrect = value;
	}
	/** @type {string} */
	#visualization: string = Visualizer.defaultVisualization;
	/**
	 * @returns {string}
	 */
	get visualization(): string {
		return this.#visualization;
	}
	/**
	 * @param {string} value 
	 * @returns {void}
	 */
	set visualization(value: string): void {
		if (!Visualizer.visualizations.includes(value)) throw new Error("Invalid value '${value}' for visualization");
		this.#visualization = value;
	}
	/** @type {Map<string, VisualizationConfiguration>} */
	#mapping: Map<string, VisualizationConfiguration> = new Map(Visualizer.visualizations.map(name => [name, new VisualizationConfiguration()]));
	/**
	 * @readonly
	 * @returns {VisualizationConfiguration}
	 */
	get configuration(): VisualizationConfiguration {
		const configuration = this.#mapping.get(this.#visualization);
		if (configuration === undefined) throw new Error("Unable to find configuration for visualization '${this.#visualization}'");
		return configuration;
	}
}
//#endregion
//#region Settings
interface SettingsNotation {
	isOpenedConfigurator?: boolean;
	visualizer: VisualizerConfigurationNotation;
}

class Settings {
	/**
	 * @param {any} source 
	 * @param {string} name 
	 * @returns {Settings}
	 */
	static import(source: any, name: string = "source"): Settings {
		try {
			const shell = Object.import(source);
			const result = new Settings();
			const isOpenedConfigurator = Reflect.get(shell, "isOpenedConfigurator");
			if (isOpenedConfigurator !== undefined) {
				result.isOpenedConfigurator = Boolean.import(isOpenedConfigurator, "property isOpenedConfigurator");
			}
			const visualizer = Reflect.get(shell, "visualizer");
			if (visualizer !== undefined) {
				result.#visualizer = VisualizerConfiguration.import(visualizer, "property visualizer");
			}
			return result;
		} catch (cause) {
			throw new TypeError("Unable to import ${(name)} due its ${typename(source)} type", { cause });
		}
	}
	/**
	 * @returns {SettingsNotation}
	 */
	export(): SettingsNotation {
		return {
			isOpenedConfigurator: this.#isOpenedConfigurator,
			visualizer: this.#visualizer.export(),
		};
	}
	/** @type {boolean} */
	#isOpenedConfigurator: boolean = false;
	/**
	 * @returns {boolean}
	 */
	get isOpenedConfigurator(): boolean {
		return this.#isOpenedConfigurator;
	}
	/**
	 * @param {boolean} value 
	 * @returns {void}
	 */
	set isOpenedConfigurator(value: boolean): void {
		this.#isOpenedConfigurator = value;
	}
	/** @type {VisualizerConfiguration} */
	#visualizer: VisualizerConfiguration = new VisualizerConfiguration();
	/**
	 * @readonly
	 * @returns {VisualizerConfiguration}
	 */
	get visualizer(): VisualizerConfiguration {
		return this.#visualizer;
	}
}
//#endregion

export { Settings };
