// src/lib/theme/theme-variants.ts

const PREMIERE_VARIANT_FAMILY = [
	'premiere-floral',
	'premiere-ivory-gold',
	'premiere-sage-gold',
	'premiere-rose-plum',
] as const;

export const QUOTE_VARIANTS = [
	'elegant',
	'modern',
	'minimal',
	'floral',
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
	...PREMIERE_VARIANT_FAMILY,
	'editorial',
] as const;

export const COUNTDOWN_VARIANTS = [
	'minimal',
	'vibrant',
	'classic',
	'modern',
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
	...PREMIERE_VARIANT_FAMILY,
	'editorial',
] as const;

export const LOCATION_VARIANTS = [
	'structured',
	'organic',
	'minimal',
	'luxury',
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
	...PREMIERE_VARIANT_FAMILY,
	'editorial',
] as const;

export const SHARED_SECTION_VARIANTS = [
	'standard',
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
	...PREMIERE_VARIANT_FAMILY,
	'editorial',
] as const;

export const ITINERARY_VARIANTS = [
	'base',
	'jewelry-box',
	'jewelry-box-wedding',
	'luxury-hacienda',
	...PREMIERE_VARIANT_FAMILY,
	'editorial',
] as const;

export const HERO_LAYOUT_VARIANTS = ['premium-portrait'] as const;
export const FAMILY_LAYOUT_VARIANTS = ['premium-mask'] as const;

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

export type QuoteVariant = (typeof QUOTE_VARIANTS)[number];
export type CountdownVariant = (typeof COUNTDOWN_VARIANTS)[number];
export type LocationVariant = (typeof LOCATION_VARIANTS)[number];
export type SharedSectionVariant = (typeof SHARED_SECTION_VARIANTS)[number];
export type ItineraryVariant = (typeof ITINERARY_VARIANTS)[number];
export type HeroLayoutVariant = (typeof HERO_LAYOUT_VARIANTS)[number];
export type FamilyLayoutVariant = (typeof FAMILY_LAYOUT_VARIANTS)[number];
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
