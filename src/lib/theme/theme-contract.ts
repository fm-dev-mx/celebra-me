export const EVENT_TYPES = ['xv', 'boda', 'bautizo', 'cumple'] as const;

export type EventType = (typeof EVENT_TYPES)[number];

// ==========================================
// THEME PRESETS - Single source of truth
// ==========================================

export const THEME_PRESETS = [
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
	'editorial',
	'premiere-floral',
	'celestial-blue',
	'angelic-presence',
] as const;

/**
 * The primary identifier for an invitation theme.
 */
export type ThemePreset = (typeof THEME_PRESETS)[number];

// ==========================================
// INDICATION TOKENS
// ==========================================

export const INDICATION_ICON_KEYS = [
	'crown',
	'envelope',
	'forbidden',
	'gift',
	'western-hat',
	'dressCode',
	'calendar',
] as const;

export const INDICATION_ICON_NAMES = [
	'Crown',
	'Envelope',
	'Forbidden',
	'Gift',
	'WesternHat',
	'Calendar',
	'DressCode',
] as const;

export const INDICATION_STYLE_VARIANTS = ['default', 'reserved'] as const;

// ==========================================
// DERIVED TYPES
// ==========================================

export type IndicationIconKey = (typeof INDICATION_ICON_KEYS)[number];
export type IndicationIconName = (typeof INDICATION_ICON_NAMES)[number];
export type IndicationStyleVariant = (typeof INDICATION_STYLE_VARIANTS)[number];

// Semantic aliases for section-specific variations (all now match the main preset)
export type QuoteVariant = ThemePreset;
export type CountdownVariant = ThemePreset;
export type LocationVariant = ThemePreset;
export type SharedSectionVariant = ThemePreset;
export type ItineraryVariant = ThemePreset;
