/**
 * Universal Asset Registry
 * Provides a deterministic way to access and optimize project assets.
 */

import { assets as DemoAlbertoSesentaAssets } from '../../assets/images/events/alberto-sesenta';
import { assets as DemoXvAssets } from '../../assets/images/events/demo-xv';
import { assets as DemoWeddingAssets } from '../../assets/images/events/demo-wedding';
import type { ImageMetadata } from 'astro';

// Social Proof
import avatar1 from '../../assets/images/hero/avatar1.png';
import avatar2 from '../../assets/images/hero/avatar2.png';
import avatar3 from '../../assets/images/hero/avatar3.png';

// Services
import serviceXv from '../../assets/images/services/xv.png';
import serviceWedding from '../../assets/images/services/wedding.png';
import serviceBaptism from '../../assets/images/services/baptism.png';
import serviceCumple from '../../assets/images/services/cumple.png';

// Header
import headerLogo from '../../assets/images/header/horizontal-logo150x56.png';

// About
import partyToast from '../../assets/images/about/party-toast-premium.png';

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

export const EVENT_KEYS = [
	'hero',
	'portrait',
	'family',
	'ceremony',
	'reception',
	'jardin',
	'signature',
	'gallery01',
	'gallery02',
	'gallery03',
	'gallery04',
	'gallery05',
	'gallery06',
	'gallery07',
	'gallery08',
	'gallery09',
	'gallery10',
	'gallery11',
	'gallery12',
	'gallery13',
	'gallery14',
] as const;

export const COMMON_KEYS = [
	'logo',
	'heroBgDesktop',
	'heroBgMobile',
	'avatar1',
	'avatar2',
	'avatar3',
	'serviceXv',
	'serviceWedding',
	'serviceBaptism',
	'serviceCumple',
	'headerLogo',
	'aboutToast',
] as const;

export type EventAssetKey = (typeof EVENT_KEYS)[number];
export type CommonAssetKey = (typeof COMMON_KEYS)[number];

/**
 * Standard schema for event-specific assets.
 * All events must implement this interface to ensure UI compatibility.
 */
export type EventAssets = Record<EventAssetKey, ImageAsset | undefined>;

/**
 * Schema for common/shared assets.
 */
export type CommonAssets = Record<CommonAssetKey, ImageAsset>;

interface Registry {
	events: Record<string, EventAssets>;
	common: CommonAssets;
}

type RawEventAssets = {
	hero: ImageMetadata;
	portrait: ImageMetadata;
	family?: ImageMetadata;
	ceremony?: ImageMetadata;
	reception?: ImageMetadata;
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
	ceremony: rawAssets.ceremony
		? { src: rawAssets.ceremony, alt: `Ceremonia de ${eventName}` }
		: undefined,
	reception: rawAssets.reception
		? { src: rawAssets.reception, alt: `Recepción de ${eventName}` }
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
		'demo-cumple': mapEventAssets(DemoAlbertoSesentaAssets, 'Don Alberto 60 años'),
		'demo-xv': mapEventAssets(DemoXvAssets, 'XV de muestra'),
		'demo-bodas': mapEventAssets(DemoWeddingAssets, 'Sofía & Alejandro'),
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
		serviceCumple: { src: serviceCumple, alt: 'Servicio de Cumpleaños' },
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
