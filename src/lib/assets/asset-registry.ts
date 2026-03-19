/**
 * Universal Asset Registry
 * Provides a deterministic way to access and optimize project assets.
 * Now using dynamic discovery to avoid manual import boilerplate.
 */

import type { ImageMetadata } from 'astro';

// Common Assets
import avatar1 from '../../assets/images/hero/avatar1.png';
import avatar2 from '../../assets/images/hero/avatar2.png';
import avatar3 from '../../assets/images/hero/avatar3.png';
import serviceXv from '../../assets/images/services/xv.png';
import serviceWedding from '../../assets/images/services/wedding.png';
import serviceBaptism from '../../assets/images/services/baptism.png';
import serviceCumple from '../../assets/images/services/cumple.png';
import headerLogo from '../../assets/images/header/horizontal-logo150x56.png';
import partyToast from '../../assets/images/about/party-toast-premium.png';

/**
 * Represents a processed image asset.
 * Note: Alt text is now handled by the Adapter to ensure decoupling.
 */
export interface ImageAsset {
	src: string | ImageMetadata;
	alt: string;
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
	'gallery15',
	'interlude01',
	'interlude02',
	'interlude03',
	'interludeNew01',
	'thankYouPortrait',
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
export const ALL_ASSET_KEYS = [...EVENT_KEYS, ...COMMON_KEYS] as const;
export type AssetRegistryKey = (typeof ALL_ASSET_KEYS)[number];

export interface InternalAssetSource {
	type: 'internal';
	key: AssetRegistryKey;
}

export interface ExternalAssetSource {
	type: 'external';
	src: string;
}

export type AssetSource = InternalAssetSource | ExternalAssetSource;

/**
 * Standard schema for event-specific assets.
 * All events must implement this interface to ensure UI compatibility.
 */
export type EventAssets = Record<EventAssetKey, ImageMetadata | undefined>;

/**
 * Schema for common/shared assets.
 */
export type CommonAssets = Record<CommonAssetKey, ImageAsset>;

interface Registry {
	events: Record<string, EventAssets>;
	common: CommonAssets;
}

import { discoverEventModules } from './discovery';

// --- DYNAMIC DISCOVERY ---

/**
 * Automatically find all event asset modules.
 */
const EVENT_ASSET_MODULES = (discoverEventModules() || {}) as Record<
	string,
	EventAssets & { gallery?: ImageMetadata[] }
>;

/**
 * Helper to extract slug from path:
 * "../../assets/images/events/example-event/index.ts" -> "example-event"
 */
const getSlugFromPath = (path: string) => path.split('/').slice(-2, -1)[0];

/**
 * Processes raw assets from modules into a flattened Registry structure.
 */
const EVENT_REGISTRY: Record<string, EventAssets> = Object.entries(EVENT_ASSET_MODULES).reduce(
	(acc, [path, rawAssets]) => {
		const slug = getSlugFromPath(path);
		const assets: Partial<EventAssets> = {
			hero: rawAssets.hero,
			portrait: rawAssets.portrait,
			family: rawAssets.family,
			ceremony: rawAssets.ceremony,
			reception: rawAssets.reception,
			jardin: rawAssets.jardin,
			signature: rawAssets.signature,
			interlude01: rawAssets.interlude01,
			interlude02: rawAssets.interlude02,
			interlude03: rawAssets.interlude03,
			interludeNew01: rawAssets.interludeNew01,
			thankYouPortrait: rawAssets.thankYouPortrait,
		};

		// Map gallery array to flat keys (gallery01...gallery15)
		if (Array.isArray(rawAssets.gallery)) {
			rawAssets.gallery.forEach((img: ImageMetadata | undefined, index: number) => {
				const key = `gallery${String(index + 1).padStart(2, '0')}` as EventAssetKey;
				assets[key] = img;
			});
		}

		acc[slug] = assets as EventAssets;
		return acc;
	},
	{} as Record<string, EventAssets>,
);

export const ImageRegistry: Registry = {
	events: EVENT_REGISTRY,
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
	} satisfies Record<CommonAssetKey, ImageAsset>,
};

export type EventSlug = keyof typeof ImageRegistry.events;

/**
 * Type guard to check if a string is a valid event slug.
 */
export function isValidEvent(slug: string): slug is EventSlug {
	return slug in ImageRegistry.events;
}

export function isEventAssetKey(key: string): key is EventAssetKey {
	return (EVENT_KEYS as readonly string[]).includes(key);
}

export function isCommonAssetKey(key: string): key is CommonAssetKey {
	return (COMMON_KEYS as readonly string[]).includes(key);
}

export function isAssetRegistryKey(key: string): key is AssetRegistryKey {
	return isEventAssetKey(key) || isCommonAssetKey(key);
}

/**
 * Get an event asset by key.
 * Now returns ImageMetadata directly. The Adapter will wrap it with Alt text.
 */
export function getEventAsset(event: string, key: EventAssetKey): ImageMetadata | undefined {
	if (!isValidEvent(event)) return undefined;
	return ImageRegistry.events[event][key];
}

/**
 * Get a common asset by key.
 */
export function getCommonAsset(key: CommonAssetKey): ImageAsset {
	return ImageRegistry.common[key];
}
