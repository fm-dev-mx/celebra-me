export const EVENT_TYPES = ['xv', 'boda', 'bautizo', 'cumple'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const CONTENT_SECTION_KEYS = [
	'quote',
	'family',
	'gallery',
	'countdown',
	'location',
	'itinerary',
	'rsvp',
	'gifts',
	'thankYou',
] as const;

export type ContentSectionKey = (typeof CONTENT_SECTION_KEYS)[number];

export const INVITATION_RENDER_SECTION_KEYS = [
	...CONTENT_SECTION_KEYS,
	'personalizedAccess',
] as const;

export type InvitationRenderSectionKey = (typeof INVITATION_RENDER_SECTION_KEYS)[number];

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
	'enchanted-rose',
	'sacred-keepsake',
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

// ==========================================
// ITINERARY TOKENS
// ==========================================

export const ITINERARY_ICON_KEYS = [
	'waltz',
	'dinner',
	'toast',
	'cake',
	'party',
	'church',
	'map',
	'reception',
	'photo',
	'sparkles',
	'boot',
	'heel',
	'western-hat',
	'taco',
	'tuba',
	'accordion',
] as const;

export type ItineraryIconKey = (typeof ITINERARY_ICON_KEYS)[number];

export const ITINERARY_ICON_DISPLAY_NAMES: Record<ItineraryIconKey, string> = {
	waltz: 'Waltz',
	dinner: 'Dinner',
	toast: 'Toast',
	cake: 'Cake',
	party: 'Party',
	church: 'Church',
	map: 'MapLocation',
	reception: 'Reception',
	photo: 'Photo',
	sparkles: 'Sparkles',
	boot: 'Boot',
	heel: 'Heel',
	'western-hat': 'WesternHat',
	taco: 'Taco',
	tuba: 'Tuba',
	accordion: 'Accordion',
};
