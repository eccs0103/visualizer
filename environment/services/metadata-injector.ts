"use strict";

import "adaptive-extender/web";

//#region Metadata
export interface MetadataDiscriminator extends PersonMetadataDiscriminator, ApplicationMetadataDiscriminator, OrganizationMetadataDiscriminator {
}

interface MetadataScheme {
	"@context": "https://schema.org";
	"@type": MetadataDiscriminator[keyof MetadataDiscriminator];
	name: string;
	url: string;
	image?: string;
	description?: string;
}

/**
 * Base configuration for the entity metadata.
 */
export interface MetadataConfiguration {
	type: keyof MetadataDiscriminator;

	/**
	 * The display name of the entity or the page title.
	 */
	name: string;

	/**
	 * The canonical public URL of the resource.
	 */
	webpage: URL;

	/**
	 * The absolute URL to the representative image (Open Graph).
	 */
	preview?: URL;

	/**
	 * A short summary of the content.
	 */
	description?: string;

	/**
	 * A set of keywords relevant to the content.
	 */
	keywords?: readonly string[];
}

class Metadata {
	#name: string;
	#webpage: URL;
	#preview: URL | undefined;
	#description: string | undefined;
	#keywords: readonly string[] | undefined;

	constructor(configuration: MetadataConfiguration) {
		if (new.target === Metadata) throw new TypeError("Unable to create an instance of an abstract class");
		this.#name = configuration.name;
		this.#webpage = configuration.webpage;
		this.#preview = configuration.preview;
		this.#description = configuration.description;
		this.#keywords = configuration.keywords;
	}

	static export(source: Metadata): MetadataScheme {
		if (source instanceof PersonMetadata) return PersonMetadata.export(source);
		if (source instanceof ApplicationMetadata) return ApplicationMetadata.export(source);
		if (source instanceof OrganizationMetadata) return OrganizationMetadata.export(source);
		throw new TypeError(`Invalid '${typename(source)}' type for source`);
	}

	get name(): string { return this.#name; }
	get webpage(): URL { return this.#webpage; }
	get preview(): URL | undefined { return this.#preview; }
	get description(): string | undefined { return this.#description; }
	get keywords(): readonly string[] | undefined { return this.#keywords; }
}
//#endregion
//#region Person metadata
export interface PersonMetadataDiscriminator {
	"Person": "Person";
}

interface PersonMetadataScheme extends MetadataScheme {
	"@type": PersonMetadataDiscriminator[keyof PersonMetadataDiscriminator];
	sameAs?: string[];
	jobTitle?: string;
	knowsAbout?: string[];
	worksFor?: {
		"@type": "Organization";
		name: string;
	};
}

/**
 * Configuration for a personal profile.
 */
export interface PersonMetadataConfiguration extends MetadataConfiguration {
	type: keyof PersonMetadataDiscriminator;

	/**
	 * A list of related social profiles or websites.
	 */
	associations?: readonly URL[];

	/**
	 * The professional job title or role.
	 */
	job?: string;

	/**
	 * A list of known skills or expertise.
	 */
	knowledge?: readonly string[];
}

class PersonMetadata extends Metadata {
	#associations: readonly URL[] | undefined;
	#job: string | undefined;
	#knowledge: readonly string[] | undefined;

	constructor(configuration: PersonMetadataConfiguration) {
		super(configuration);
		this.#associations = configuration.associations;
		this.#job = configuration.job;
		this.#knowledge = configuration.knowledge;
	}

	static export(source: PersonMetadata): PersonMetadataScheme {
		const $context = "https://schema.org" as const;
		const $type = "Person";
		const name = source.name;
		const url = String(source.webpage);
		const image = Reflect.mapUndefined(source.preview, preview => String(preview));
		const description = source.description;
		const sameAs = Reflect.mapUndefined(source.associations, associations => associations.map(association => String(association)));
		const jobTitle = source.job;
		const knowsAbout = Reflect.mapUndefined(source.knowledge, knowledge => knowledge.map(subject => subject));
		return { "@context": $context, "@type": $type, name, url, image, description, sameAs, jobTitle, knowsAbout };
	}

	get associations(): readonly URL[] | undefined { return this.#associations; }
	get job(): string | undefined { return this.#job; }
	get knowledge(): readonly string[] | undefined { return this.#knowledge; }
}
//#endregion
//#region Application metadata
export interface ApplicationMetadataDiscriminator {
	"Application": "SoftwareApplication";
}

interface ApplicationMetadataScheme extends MetadataScheme {
	"@type": ApplicationMetadataDiscriminator[keyof ApplicationMetadataDiscriminator];
	applicationCategory: string;
	operatingSystem: string;
	softwareVersion?: string;
	offers?: {
		"@type": "Offer";
		price: "0";
		priceCurrency: "USD";
	};
}

/**
 * Configuration for a software application.
 */
export interface ApplicationMetadataConfiguration extends MetadataConfiguration {
	type: keyof ApplicationMetadataDiscriminator;

	/**
	 * The general category of the application.
	 */
	category: string;

	/**
	 * The required operating system.
	 */
	os: string;

	/**
	 * The current version identifier.
	 */
	version?: string;
}

class ApplicationMetadata extends Metadata {
	#category: string;
	#os: string;
	#version: string | undefined;

	constructor(configuration: ApplicationMetadataConfiguration) {
		super(configuration);
		this.#category = configuration.category;
		this.#os = configuration.os ?? "Web Browser";
		this.#version = configuration.version;
	}

	static export(source: ApplicationMetadata): ApplicationMetadataScheme {
		const $context = "https://schema.org" as const;
		const $type = "SoftwareApplication";
		const name = source.name;
		const url = String(source.webpage);
		const image = Reflect.mapUndefined(source.preview, preview => String(preview));
		const description = source.description;
		const applicationCategory = source.category;
		const operatingSystem = source.os;
		const softwareVersion = source.version;
		return { "@context": $context, "@type": $type, name, url, image, description, applicationCategory, operatingSystem, softwareVersion };
	}

	get category(): string { return this.#category; }
	get os(): string { return this.#os; }
	get version(): string | undefined { return this.#version; }
}
//#endregion
//#region Organization metadata
interface OrganizationMetadataDiscriminator {
	"Organization": "Organization";
}

interface OrganizationMetadataScheme extends MetadataScheme {
	"@type": OrganizationMetadataDiscriminator[keyof OrganizationMetadataDiscriminator];
	logo?: string;
	email?: string;
	foundingDate?: string;
	address?: {
		"@type": "PostalAddress";
		addressLocality: string;
		addressCountry: string;
	};
}

/**
 * Configuration for an organization.
 */
export interface OrganizationMetadataConfiguration extends MetadataConfiguration {
	type: keyof OrganizationMetadataDiscriminator;

	/**
	 * The URL to the organization's logo image.
	 */
	logo?: URL;

	/**
	 * The primary contact email.
	 */
	email?: string;

	/**
	 * The date the organization was established.
	 */
	foundation?: Date;
}

class OrganizationMetadata extends Metadata {
	#logo: URL | undefined;
	#email: string | undefined;
	#foundation: Date | undefined;

	constructor(configuration: OrganizationMetadataConfiguration) {
		super(configuration);
		this.#logo = configuration.logo;
		this.#email = configuration.email;
		this.#foundation = configuration.foundation;
	}

	static export(source: OrganizationMetadata): OrganizationMetadataScheme {
		const $context = "https://schema.org" as const;
		const $type = "Organization";
		const name = source.name;
		const url = String(source.webpage);
		const image = Reflect.mapUndefined(source.preview, preview => String(preview));
		const description = source.description;
		const logo = Reflect.mapUndefined(source.logo, logo => String(logo));
		const email = source.email;
		const foundingDate = String(source.foundation);
		return { "@context": $context, "@type": $type, name, url, image, description, logo, email, foundingDate };
	}

	get logo(): URL | undefined { return this.#logo; }
	get email(): string | undefined { return this.#email; }
	get foundation(): Date | undefined { return this.#foundation; }
}
//#endregion

//#region Metadata injector
export class MetadataInjector {
	static #lock: boolean = true;
	static #instance: MetadataInjector | null = null;

	constructor() {
		if (MetadataInjector.#lock) throw new TypeError("Illegal constructor");
	}

	#compose(configuration: OrganizationMetadataConfiguration | ApplicationMetadataConfiguration | PersonMetadataConfiguration): Metadata {
		switch (configuration.type) {
		case "Person": return new PersonMetadata(configuration);
		case "Application": return new ApplicationMetadata(configuration);
		case "Organization": return new OrganizationMetadata(configuration);
		default: throw new TypeError(`Invalid '${typename(configuration)}' type for configuration`);
		}
	}

	#embedMetadataScript(metadata: Metadata): void {
		const scheme = Metadata.export(metadata);
		const script = document.createElement("script");
		script.type = "application/ld+json";
		script.textContent = JSON.stringify(scheme, undefined, "\t");
		const { head } = document;
		const child =
			document.querySelector("script") ??
			head.lastElementChild;
		head.insertBefore(script, child);
	}

	#embedRelLinks(metadata: Metadata): void {
		if (!(metadata instanceof PersonMetadata)) return;
		if (metadata.associations === undefined) return;
		const { head } = document;
		for (const association of metadata.associations) {
			const link = document.createElement("link");
			link.rel = "me";
			link.href = String(association);
			head.appendChild(link);
		}
	}

	#setMetadata(name: string, content: string): void {
		const meta =
			document.querySelector(`meta[name="${name}"]`) ??
			document.querySelector(`meta[property="${name}"]`) ??
			document.createElement("meta");
		meta.setAttribute(name.startsWith("og:") ? "property" : "name", name);
		meta.setAttribute("content", content);
		const { head } = document;
		const child =
			document.querySelector("title") ??
			document.querySelector("meta:last-of-type + *") ??
			head.firstElementChild;
		head.insertBefore(meta, child);
	}

	#embedMetatags(metadata: Metadata): void {
		if (metadata.description !== undefined) this.#setMetadata("description", metadata.description);
		if (metadata instanceof PersonMetadata) this.#setMetadata("author", metadata.name);
		this.#setMetadata("generator", "MetadataInjector/1.0.0");
		if (metadata instanceof ApplicationMetadata) this.#setMetadata("application-name", metadata.name);
		this.#setMetadata("og:title", metadata.name);
		if (metadata.description !== undefined) this.#setMetadata("og:description", metadata.description);
		this.#setMetadata("og:url", String(metadata.webpage));
		if (metadata.preview !== undefined) this.#setMetadata("og:image", String(metadata.preview));
		this.#setMetadata("og:type", metadata instanceof PersonMetadata ? "profile" : "website");
		const keywords: string[] = [];
		if (metadata.keywords !== undefined) keywords.push(...metadata.keywords);
		if (metadata instanceof PersonMetadata && metadata.knowledge !== undefined) keywords.push(...metadata.knowledge);
		if (keywords.length > 0) this.#setMetadata("keywords", Array.from(new Set(keywords)).join(","));
	}

	#embed(configuration: OrganizationMetadataConfiguration | ApplicationMetadataConfiguration | PersonMetadataConfiguration): void {
		const metadata = this.#compose(configuration);
		this.#embedMetadataScript(metadata);
		this.#embedRelLinks(metadata);
		this.#embedMetatags(metadata);
	}

	static inject(configuration: PersonMetadataConfiguration): void;
	static inject(configuration: ApplicationMetadataConfiguration): void;
	static inject(configuration: OrganizationMetadataConfiguration): void;
	static inject(configuration: OrganizationMetadataConfiguration | ApplicationMetadataConfiguration | PersonMetadataConfiguration): void {
		if (MetadataInjector.#instance !== null) return;
		MetadataInjector.#lock = false;
		const instance = MetadataInjector.#instance = new MetadataInjector();
		MetadataInjector.#lock = true;
		instance.#embed(configuration);
	}
}
//#endregion
