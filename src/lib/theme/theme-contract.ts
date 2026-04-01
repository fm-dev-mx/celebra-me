import type { LocationVariant } from './theme-variants';

export const EVENT_TYPES = ['xv', 'boda', 'bautizo', 'cumple'] as const;

export const THEME_PRESETS = [
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
	'premiere-floral',
	'editorial',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type ThemePreset = (typeof THEME_PRESETS)[number];

export const LOCATION_VARIANT_PRESET_COMPATIBILITY = {
	editorial: ['editorial', 'premiere-floral'],
	'premiere-floral': ['premiere-floral'],
} as const satisfies Partial<Record<LocationVariant, readonly ThemePreset[]>>;

export * from './theme-variants';
