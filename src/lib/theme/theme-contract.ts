export const EVENT_TYPES = [
	'xv',
	'boda',
	'bautizo',
	'cumple',
	'baby-shower',
	'primera-comunion',
] as const;
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
	'editorial-rose',
	'editorial-magazine',
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
// THEME CAPABILITIES
// ==========================================

/**
 * Themes whose hero section renders `hero.portrait` visibly.
 * Themes not in this set hide the portrait (e.g. via `display: none`).
 *
 * When adding a new theme, update this list (and matching CSS if portrait is hidden).
 */
export const PORTRAIT_SUPPORTED_THEMES: ReadonlySet<ThemePreset> = new Set([
	'editorial',
	'editorial-magazine',
	'premiere-floral',
	'sacred-keepsake',
	'angelic-presence',
]);

/**
 * Themes that intentionally hide the portrait in the hero section.
 * Derived as the complement of PORTRAIT_SUPPORTED_THEMES within THEME_PRESETS.
 */
export const PORTRAIT_HIDDEN_THEMES: ReadonlySet<ThemePreset> = new Set(
	THEME_PRESETS.filter((theme) => !PORTRAIT_SUPPORTED_THEMES.has(theme)),
);

export function themeSupportsPortrait(themeId: string): boolean {
	return PORTRAIT_SUPPORTED_THEMES.has(themeId as ThemePreset);
}

export function isEventType(value: string): value is EventType {
	return (EVENT_TYPES as readonly string[]).includes(value);
}

// ==========================================
// INDICATION TOKENS
// ==========================================

export const INDICATION_STYLE_VARIANTS = ['default', 'reserved'] as const;

// ==========================================
// DERIVED TYPES
// ==========================================

export type IndicationStyleVariant = (typeof INDICATION_STYLE_VARIANTS)[number];

// Semantic aliases for section-specific variations (all now match the main preset)
export type QuoteVariant = ThemePreset;
export type CountdownVariant = ThemePreset;
export type LocationVariant = ThemePreset;
export type SharedSectionVariant = ThemePreset;
export type ItineraryVariant = ThemePreset;
