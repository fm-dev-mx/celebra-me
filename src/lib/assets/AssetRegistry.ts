/**
 * Universal Asset Registry
 * Provides a deterministic way to access and optimize project assets.
 */

import { assets as Cumple60GerardoAssets } from '../../assets/images/events/cumple-60-gerardo';
import { assets as DemoXvAssets } from '../../assets/images/events/demo-xv';
import heroBgDesktop from '../../assets/images/hero/bgHeroDesktop.jpg';
import heroBgMobile from '../../assets/images/hero/bgHeroMobile.jpg';

/**
 * Represents a processed image asset.
 */
export interface ImageAsset {
	src: string | ImageMetadata;
	alt: string;
	resolutions?: {
		x1: string;
		x2: string;
		x3?: string;
	};
}

/**
 * Standard schema for event-specific assets.
 * All events must implement this interface to ensure UI compatibility.
 */
export interface EventAssets {
	hero: ImageAsset;
	portrait: ImageAsset;
	family?: ImageAsset; // Optional: Family portrait
	jardin: ImageAsset;
	signature: ImageAsset;
	gallery01: ImageAsset;
	gallery02: ImageAsset;
	gallery03: ImageAsset;
	gallery04: ImageAsset;
	gallery05: ImageAsset;
	gallery06: ImageAsset;
	gallery07: ImageAsset;
	gallery08: ImageAsset;
	gallery09: ImageAsset;
	gallery10: ImageAsset;
	gallery11: ImageAsset;
	gallery12?: ImageAsset; // Optional: Extra gallery image
}

/**
 * Schema for common/shared assets.
 */
export interface CommonAssets {
	logo: ImageAsset;
	heroBgDesktop: ImageAsset;
	heroBgMobile: ImageAsset;
}

interface Registry {
	events: Record<string, EventAssets>;
	common: CommonAssets;
}

// Event-specific asset mapping helpers
// Using 'any' for rawAssets to allow flexibility between event exports without strict type intersection
// in this utility, relying on the return type EventAssets to enforce correct structure.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapEventAssets = (rawAssets: any, eventName: string): EventAssets => ({
	hero: { src: rawAssets.hero, alt: `${eventName} Hero` },
	portrait: { src: rawAssets.portrait, alt: `${eventName} Portrait` },
	family: rawAssets.family
		? { src: rawAssets.family, alt: `${eventName} Family` }
		: undefined,
	jardin: { src: rawAssets.jardin, alt: `${eventName} Venue` },
	signature: { src: rawAssets.signature, alt: `${eventName} Signature` },
	gallery01: { src: rawAssets.gallery[0], alt: `${eventName} Gallery 01` },
	gallery02: { src: rawAssets.gallery[1], alt: `${eventName} Gallery 02` },
	gallery03: { src: rawAssets.gallery[2], alt: `${eventName} Gallery 03` },
	gallery04: { src: rawAssets.gallery[3], alt: `${eventName} Gallery 04` },
	gallery05: { src: rawAssets.gallery[4], alt: `${eventName} Gallery 05` },
	gallery06: { src: rawAssets.gallery[5], alt: `${eventName} Gallery 06` },
	gallery07: { src: rawAssets.gallery[6], alt: `${eventName} Gallery 07` },
	gallery08: { src: rawAssets.gallery[7], alt: `${eventName} Gallery 08` },
	gallery09: { src: rawAssets.gallery[8], alt: `${eventName} Gallery 09` },
	gallery10: { src: rawAssets.gallery[9], alt: `${eventName} Gallery 10` },
	gallery11: { src: rawAssets.gallery[10], alt: `${eventName} Gallery 11` },
	gallery12: rawAssets.gallery[11]
		? { src: rawAssets.gallery[11], alt: `${eventName} Gallery 12` }
		: undefined,
});

export const ImageRegistry: Registry = {
	events: {
		'cumple-60-gerardo': mapEventAssets(Cumple60GerardoAssets, 'Gerardo 60th'),
		'demo-xv': mapEventAssets(DemoXvAssets, 'Demo XV'),
	},
	common: {
		logo: {
			src: '/icons/favicon.svg',
			alt: 'Celebra-me Logo',
		},
		heroBgDesktop: {
			src: heroBgDesktop,
			alt: 'Landing Hero Desktop',
		},
		heroBgMobile: {
			src: heroBgMobile,
			alt: 'Landing Hero Mobile',
		},
	},
};

export type EventSlug = keyof typeof ImageRegistry.events;
export type CommonAssetKey = keyof typeof ImageRegistry.common;
export type EventAssetKey = keyof EventAssets;

/**
 * Type guard to check if a string is a valid event slug.
 */
export function isValidEvent(slug: string): slug is EventSlug {
	return slug in ImageRegistry.events;
}

/**
 * Get an event asset by key with strict typing.
 */
export function getEventAsset(event: string, key: EventAssetKey): ImageAsset | undefined {
	if (!isValidEvent(event)) return undefined;
	return ImageRegistry.events[event][key];
}

/**
 * Get a common asset by key.
 */
export function getCommonAsset(key: CommonAssetKey): ImageAsset {
	return ImageRegistry.common[key];
}

