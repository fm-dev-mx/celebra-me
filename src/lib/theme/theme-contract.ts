export const EVENT_TYPES = ['xv', 'boda', 'bautizo', 'cumple'] as const;

export const THEME_PRESETS = [
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
	'top-premium-xv-ximena',
] as const;
export const QUOTE_VARIANTS = [
	'elegant',
	'modern',
	'minimal',
	'floral',
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
] as const;
export const COUNTDOWN_VARIANTS = [
	'minimal',
	'vibrant',
	'classic',
	'modern',
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
] as const;
export const LOCATION_VARIANTS = [
	'structured',
	'organic',
	'minimal',
	'luxury',
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
] as const;
export const SHARED_SECTION_VARIANTS = [
	'standard',
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
] as const;
export const ITINERARY_VARIANTS = [
	'base',
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
] as const;

export const LOCATION_MAP_STYLES = ['dark', 'colorful', 'minimal', 'satellite'] as const;
export const QUOTE_ANIMATIONS = ['fade', 'bounce', 'elastic', 'none'] as const;
export const QUOTE_FONT_STYLES = ['serif', 'script', 'sans'] as const;
export const COUNTDOWN_NUMBER_STYLES = ['thin', 'bold', 'monospace'] as const;

export const INDICATION_ICON_KEYS = [
	'crown',
	'envelope',
	'forbidden',
	'gift',
	'western-hat',
	'dress',
] as const;
export const INDICATION_ICON_NAMES = [
	'Crown',
	'Envelope',
	'Forbidden',
	'Gift',
	'western-hat',
] as const;
export const INDICATION_STYLE_VARIANTS = ['default', 'reserved'] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type ThemePreset = (typeof THEME_PRESETS)[number];
export type QuoteVariant = (typeof QUOTE_VARIANTS)[number];
export type CountdownVariant = (typeof COUNTDOWN_VARIANTS)[number];
export type LocationVariant = (typeof LOCATION_VARIANTS)[number];
export type SharedSectionVariant = (typeof SHARED_SECTION_VARIANTS)[number];
export type ItineraryVariant = (typeof ITINERARY_VARIANTS)[number];
export type LocationMapStyle = (typeof LOCATION_MAP_STYLES)[number];
export type QuoteAnimation = (typeof QUOTE_ANIMATIONS)[number];
export type QuoteFontStyle = (typeof QUOTE_FONT_STYLES)[number];
export type CountdownNumberStyle = (typeof COUNTDOWN_NUMBER_STYLES)[number];
export type IndicationIconKey = (typeof INDICATION_ICON_KEYS)[number];
export type IndicationIconName = (typeof INDICATION_ICON_NAMES)[number];
export type IndicationStyleVariant = (typeof INDICATION_STYLE_VARIANTS)[number];

export const LEGACY_INDICATION_ICON_MAP: Record<IndicationIconKey, IndicationIconName> = {
	crown: 'Crown',
	envelope: 'Envelope',
	forbidden: 'Forbidden',
	gift: 'Gift',
	'western-hat': 'western-hat',
	dress: 'Gift',
};
