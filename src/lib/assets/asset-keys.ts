/**
 * Shared asset key constants and type guards.
 * Neutral module: no runtime build-time registry dependency.
 */

export const EVENT_KEYS = [
	'hero',
	'portrait',

	'family',
	'ceremony',
	'reception',
	'mapCeremony',
	'mapReception',
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
	'interlude04',
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

export function isEventAssetKey(key: string): key is EventAssetKey {
	return (EVENT_KEYS as readonly string[]).includes(key);
}

export function isCommonAssetKey(key: string): key is CommonAssetKey {
	return (COMMON_KEYS as readonly string[]).includes(key);
}

export function isAssetRegistryKey(key: string): key is AssetRegistryKey {
	return isEventAssetKey(key) || isCommonAssetKey(key);
}
