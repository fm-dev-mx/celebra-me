export const EVENT_TYPES = ['xv', 'boda', 'bautizo', 'cumple'] as const;

export const THEME_PRESETS = [
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
	'top-premium-floral',
	'editorial',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type ThemePreset = (typeof THEME_PRESETS)[number];

export * from './theme-variants';
