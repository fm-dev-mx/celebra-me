// src/core/interfaces/data/siteData.interface.ts
import { IconNames } from '@/core/types/ui/iconNames.type';
/**
 * Interface for general site information.
 */
export interface SiteInfo {
	title: string;
	slogan?: string;
	description: string;
	lang: string;
	charset: string;
}

/**
 * Interface for meta tags and SEO-related information.
 */
export interface Meta extends SiteInfo {
	seoData: SeoData;
}

/**
 * Interface representing the entire site data including metadata and site information.
 */
export interface SiteData {
	meta: Meta;
	siteInfo: SiteInfo;
}

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
	sameAs?: string[];
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

/**
 * Interface for social data including social links.
 */
export interface SocialData {
	socialLinks: SocialLink[];
}

/**
 * Interface for individual social link.
 */
export interface SocialLink {
	icon: IconNames;
	href: string;
	title?: string;
}
