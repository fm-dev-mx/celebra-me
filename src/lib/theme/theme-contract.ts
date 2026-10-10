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
	'memories',
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

export const INVITATION_REVEAL_RECIPES = [
	'none',
	'fade',
	'fade-up',
	'media-scale',
	'stagger-group',
] as const;

export type InvitationRevealRecipe = (typeof INVITATION_REVEAL_RECIPES)[number];

export const SECTION_INTERSECTION_FAMILIES = [
	'neutral',
	'arch',
	'overlap',
	'atmospheric-blend',
	'pattern-band',
] as const;

export type SectionIntersectionFamily = (typeof SECTION_INTERSECTION_FAMILIES)[number];

/**
 * Decorative line-art sets that sections pick up at fixed positions (heading emblems, rule
 * separators, closing horizon). Purely presentational: CSS pseudo-elements, aria-hidden by nature.
 */
export const SECTION_ORNAMENT_SETS = ['seaside-lineart'] as const;
export type { LocationVariant, ItineraryVariant } from '@/lib/invitation/section-variants';
export { ITINERARY_VARIANTS } from '@/lib/invitation/section-variants';

export type {
	CountdownVariant,
	QuoteVariant,
	SharedSectionVariant,
} from '@/lib/invitation/section-variants';
export { COUNTDOWN_VARIANTS, STANDARD_SECTION_VARIANTS } from '@/lib/invitation/section-variants';
