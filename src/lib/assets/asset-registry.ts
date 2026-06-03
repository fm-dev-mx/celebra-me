/**
 * Universal Asset Registry
 * Provides a deterministic way to access and optimize project assets.
 * Now using dynamic discovery to avoid manual import boilerplate.
 *
 * This module focuses on build-time internal assets.
 * Shared key constants and types live in asset-keys.ts and asset-source.ts.
 */

import type { ImageMetadata } from 'astro';
import type {
	InternalAssetSource,
	ExternalAssetSource,
	AssetSource,
} from '@/lib/assets/asset-source';
import {
	EVENT_KEYS,
	isEventAssetKey,
	isCommonAssetKey,
	isAssetRegistryKey,
	type EventAssetKey,
	type CommonAssetKey,
	type AssetRegistryKey,
} from '@/lib/assets/asset-keys';

// Common Assets
import avatar1 from '@images/hero/avatar1.png';
import avatar2 from '@images/hero/avatar2.png';
import avatar3 from '@images/hero/avatar3.png';
import serviceXv from '@images/services/xv.png';
import serviceWedding from '@images/services/wedding.png';
import serviceBaptism from '@images/services/baptism.png';
import serviceCumple from '@images/services/cumple.png';
import headerLogo from '@images/header/horizontal-logo150x56.png';
import partyToast from '@images/about/party-toast-premium.png';

/**
 * Represents a processed image asset.
 * Note: Alt text is now handled by the Adapter to ensure decoupling.
 */
export interface ImageAsset {
	src: string | ImageMetadata;
	alt: string;
}

// Re-export shared types for backward compatibility
export type { InternalAssetSource, ExternalAssetSource, AssetSource };
export { isEventAssetKey, isCommonAssetKey, isAssetRegistryKey };
export type { EventAssetKey, CommonAssetKey, AssetRegistryKey };
export { EVENT_KEYS, COMMON_KEYS, ALL_ASSET_KEYS } from '@/lib/assets/asset-keys';

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

import { discoverEventModules } from '@/lib/assets/discovery';

// --- DYNAMIC DISCOVERY ---

/**
 * Automatically find all event asset modules.
 */
const EVENT_ASSET_MODULES = (discoverEventModules() ?? {}) as Record<
	string,
	EventAssets & { gallery?: ImageMetadata[] }
>;

/**
 * Processes raw assets from modules into a flattened Registry structure.
 */
const EVENT_REGISTRY: Record<string, EventAssets> = Object.entries(EVENT_ASSET_MODULES).reduce(
	(acc, [path, rawAssets]) => {
		const slug = path.split('/').slice(-2, -1)[0];
		const assets: Partial<EventAssets> = {};

		// Map explicit EVENT_KEYS if present in rawAssets
		EVENT_KEYS.forEach((key) => {
			if (rawAssets[key]) {
				assets[key] = rawAssets[key] as ImageMetadata;
			}
		});

		// Map gallery array to flat keys (gallery01...gallery15) if not already explicitly defined
		if (Array.isArray(rawAssets.gallery)) {
			rawAssets.gallery.forEach((img: ImageMetadata | undefined, index: number) => {
				const key = `gallery${String(index + 1).padStart(2, '0')}` as EventAssetKey;
				if (!assets[key]) {
					assets[key] = img;
				}
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
