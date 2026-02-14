/**
 * Universal Asset Registry
 * Provides a deterministic way to access and optimize project assets.
 */

import { assets as GerardoSesentaAssets } from '../../assets/images/events/gerardo-sesenta';
import { assets as DemoXvAssets } from '../../assets/images/events/demo-xv';
import type { ImageMetadata } from 'astro';

// Social Proof
import avatar1 from '../../assets/images/hero/avatar1.png';
import avatar2 from '../../assets/images/hero/avatar2.png';
import avatar3 from '../../assets/images/hero/avatar3.png';

// Services
import serviceXv from '../../assets/images/services/xv.png';
import serviceWedding from '../../assets/images/services/wedding.png';
import serviceBaptism from '../../assets/images/services/baptism.png';

// Header
import headerLogo from '../../assets/images/header/horizontalLogo150x56.png';

// About
import partyToast from '../../assets/images/about/partyToastPremium.png';

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
	gallery13?: ImageAsset; // Optional: Extra gallery image
	gallery14?: ImageAsset; // Optional: Extra gallery image
}

/**
 * Schema for common/shared assets.
 */
export interface CommonAssets {
	logo: ImageAsset;
	heroBgDesktop: ImageAsset;
	heroBgMobile: ImageAsset;
	// Social Proof
	avatar1: ImageAsset;
	avatar2: ImageAsset;
	avatar3: ImageAsset;
	// Services
	serviceXv: ImageAsset;
	serviceWedding: ImageAsset;
	serviceBaptism: ImageAsset;
	// Header
	headerLogo: ImageAsset;
	// About
	aboutToast: ImageAsset;
}

interface Registry {
	events: Record<string, EventAssets>;
	common: CommonAssets;
}

type RawEventAssets = {
	hero: ImageMetadata;
	portrait: ImageMetadata;
	family?: ImageMetadata;
	jardin: ImageMetadata;
	signature: ImageMetadata;
	gallery: ImageMetadata[];
};

// Event-specific asset mapping helpers
const mapEventAssets = (rawAssets: RawEventAssets, eventName: string): EventAssets => ({
	hero: { src: rawAssets.hero, alt: `Portada de ${eventName}` },
	portrait: { src: rawAssets.portrait, alt: `Retrato de ${eventName}` },
	family: rawAssets.family
		? { src: rawAssets.family, alt: `Familia de ${eventName}` }
		: undefined,
	jardin: { src: rawAssets.jardin, alt: `Sede de ${eventName}` },
	signature: { src: rawAssets.signature, alt: `Firma de ${eventName}` },
	gallery01: { src: rawAssets.gallery[0], alt: `Galería 01 de ${eventName}` },
	gallery02: { src: rawAssets.gallery[1], alt: `Galería 02 de ${eventName}` },
	gallery03: { src: rawAssets.gallery[2], alt: `Galería 03 de ${eventName}` },
	gallery04: { src: rawAssets.gallery[3], alt: `Galería 04 de ${eventName}` },
	gallery05: { src: rawAssets.gallery[4], alt: `Galería 05 de ${eventName}` },
	gallery06: { src: rawAssets.gallery[5], alt: `Galería 06 de ${eventName}` },
	gallery07: { src: rawAssets.gallery[6], alt: `Galería 07 de ${eventName}` },
	gallery08: { src: rawAssets.gallery[7], alt: `Galería 08 de ${eventName}` },
	gallery09: { src: rawAssets.gallery[8], alt: `Galería 09 de ${eventName}` },
	gallery10: { src: rawAssets.gallery[9], alt: `Galería 10 de ${eventName}` },
	gallery11: { src: rawAssets.gallery[10], alt: `Galería 11 de ${eventName}` },
	gallery12: rawAssets.gallery[11]
		? { src: rawAssets.gallery[11], alt: `Galería 12 de ${eventName}` }
		: undefined,
	gallery13: rawAssets.gallery[12]
		? { src: rawAssets.gallery[12], alt: `Galería 13 de ${eventName}` }
		: undefined,
	gallery14: rawAssets.gallery[13]
		? { src: rawAssets.gallery[13], alt: `Galería 14 de ${eventName}` }
		: undefined,
});

export const ImageRegistry: Registry = {
	events: {
		'gerardo-sesenta': mapEventAssets(GerardoSesentaAssets, 'Gerardo 60 años'),
		'demo-xv': mapEventAssets(DemoXvAssets, 'XV de muestra'),
	},
	common: {
		logo: {
			src: '/icons/favicon.svg',
			alt: 'Logotipo de Celebra-me',
		},
		avatar1: { src: avatar1, alt: 'Usuario de Celebra-me' },
		avatar2: { src: avatar2, alt: 'Usuario de Celebra-me' },
		avatar3: { src: avatar3, alt: 'Usuario de Celebra-me' },
		serviceXv: { src: serviceXv, alt: 'Servicio de XV Años' },
		serviceWedding: { src: serviceWedding, alt: 'Servicio de Bodas' },
		serviceBaptism: { src: serviceBaptism, alt: 'Servicio de Bautizos' },
		headerLogo: { src: headerLogo, alt: 'Celebra-me Logo' },
		aboutToast: { src: partyToast, alt: 'Celebración elegante con brindis' },
		heroBgDesktop: {
			src: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=2069',
			alt: 'Fondo Hero',
		},
		heroBgMobile: {
			src: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=2069',
			alt: 'Fondo Hero',
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
