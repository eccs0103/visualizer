"use strict";

import "adaptive-extender/web";
import { type Engine, FastEngine } from "adaptive-extender/web";
import { Audioset } from "../studio/models/audioset.js";

//#region Visualization configuration
interface VisualizationConfigurationNotation {
	quality?: number;
	smoothing?: number;
	focus?: number;
	spread?: number;
}

class VisualizationConfiguration {
	#quality: number = 10;
	#smoothing: number = 0.7;
	#focus: number = -65;
	#spread: number = 35;

	get quality(): number {
		return this.#quality;
	}

	set quality(value: number) {
		if (!Audioset.Manager.checkQuality(value)) throw new Error("Invalid value '${value}' for quality");
		this.#quality = value;
	}
	
	get smoothing(): number {
		return this.#smoothing;
	}

	set smoothing(value: number) {
		if (!Audioset.Manager.checkSmoothing(value)) throw new Error("Invalid value '${value}' for smoothing");
		this.#smoothing = value;
	}
	
	get focus(): number {
		return this.#focus;
	}

	set focus(value: number) {
		if (!Audioset.Manager.checkFocus(value)) throw new Error("Invalid value '${value}' for focus");
		this.#focus = value;
	}
	
	get spread(): number {
		return this.#spread;
	}
	
	set spread(value: number) {
		if (!Audioset.Manager.checkSpread(value)) throw new Error("Invalid value '${value}' for spread");
		this.#spread = value;
	}

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

	export(): VisualizationConfigurationNotation {
		return {
			quality: this.#quality,
			smoothing: this.#smoothing,
			focus: this.#focus,
			spread: this.#spread,
		};
	}
}
//#endregion
//#region Visualization attachment
type VisualizationAttachmentNotation = [string, VisualizationConfigurationNotation];

class VisualizationAttachment {
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
	export(): VisualizationAttachmentNotation {
		return [
			this.#name,
			this.#configuration.export()
		];
	}
	static fromArray(source: Readonly<[string, VisualizationConfiguration]>): VisualizationAttachment {
		const [name, configuration] = source;
		return new VisualizationAttachment(name, configuration);
	}
	toArray(): [string, VisualizationConfiguration] {
		return [this.#name, this.#configuration];
	}
	constructor(name: string, configuration: VisualizationConfiguration) {
		this.#name = name;
		this.#configuration = configuration;
	}
	#name: string;
	get name(): string {
		return this.#name;
	}
	#configuration: VisualizationConfiguration;
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
	export(): VisualizerConfigurationNotation {
		return {
			rate: this.#rate,
			autocorrect: this.#autocorrect,
			visualization: this.#visualization,
			attachments: Array.from(this.#mapping).map(attachment => VisualizationAttachment.fromArray(attachment).export())
		};
	};
	#rate: number = 120;
	get rate(): number {
		return this.#rate;
	}
	set rate(value: number) {
		if (!Visualizer.checkRate(value)) throw new Error("Invalid value '${value}' for rate");
		this.#rate = value;
	}
	#autocorrect: boolean = false;
	get autocorrect(): boolean {
		return this.#autocorrect;
	}
	set autocorrect(value: boolean) {
		this.#autocorrect = value;
	}
	#visualization: string = Visualizer.defaultVisualization;
	get visualization(): string {
		return this.#visualization;
	}
	set visualization(value: string) {
		if (!Visualizer.visualizations.includes(value)) throw new Error("Invalid value '${value}' for visualization");
		this.#visualization = value;
	}
	#mapping: Map<string, VisualizationConfiguration> = new Map(Visualizer.visualizations.map(name => [name, new VisualizationConfiguration()]));
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
	export(): SettingsNotation {
		return {
			isOpenedConfigurator: this.#isOpenedConfigurator,
			visualizer: this.#visualizer.export(),
		};
	}
	#isOpenedConfigurator: boolean = false;
	get isOpenedConfigurator(): boolean {
		return this.#isOpenedConfigurator;
	}
	set isOpenedConfigurator(value: boolean) {
		this.#isOpenedConfigurator = value;
	}
	#visualizer: VisualizerConfiguration = new VisualizerConfiguration();
	get visualizer(): VisualizerConfiguration {
		return this.#visualizer;
	}
}
//#endregion

export { Settings };
