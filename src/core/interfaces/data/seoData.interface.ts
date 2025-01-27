// src/core/interfaces/data/seoData.interface.ts

/**
 * Interface for structured SEO data.
 */
export interface SeoData {
	'@context': string;
	'@type': string;
	name: string;
	description: string;
	url: string;
	logo?: string;
	keywords?: string[];
	author?: Author;
	contactPoint?: ContactPoint;
	foundingDate?: string;
	address?: Address;
	sameAs?: string[]; // Social links for SEO
	openGraph?: OpenGraph;
	twitter?: Twitter;
}

/**
 * Interface for author information.
 */
export interface Author {
	'@type': string;
	name: string;
}

/**
 * Interface for contact point information.
 */
export interface ContactPoint {
	'@type': string;
	email: string;
	contactType: string;
	telephone?: string;
	areaServed?: string;
	availableLanguage?: string[];
}

/**
 * Interface for address information.
 */
export interface Address {
	'@type': string;
	addressLocality: string;
	addressRegion: string;
	postalCode: string;
	addressCountry: string;
}

/**
 * Interface for Open Graph data.
 */
export interface OpenGraph {
	title: string;
	description: string;
	image: string;
	url: string;
	type: string;
}

/**
 * Interface for Twitter card data.
 */
export interface Twitter {
	card: string;
	title: string;
	description: string;
	image: string;
	url: string;
	type?: string;
}
