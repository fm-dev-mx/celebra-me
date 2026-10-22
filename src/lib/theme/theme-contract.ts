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

export interface ThemePresetMetadata {
	/** The hero renders `hero.portrait` visibly; other presets hide it (e.g. `display: none`). */
	portrait: boolean;
	/** Event types with a published invitation or demo on this preset. Widening one needs a
	 * definition or demo that uses it plus its visual verification. */
	eventTypes: readonly EventType[];
}

/**
 * One row per theme preset. Each preset also needs its stylesheet entrypoints in
 * `src/styles/invitation-presets/` and `src/styles/invitation-sections-by-preset/`.
 */
export const THEME_PRESET_METADATA = {
	'jewelry-box': { portrait: false, eventTypes: ['xv'] },
	'jewelry-box-wedding': { portrait: false, eventTypes: ['boda'] },
	'luxury-hacienda': { portrait: false, eventTypes: ['cumple'] },
	editorial: { portrait: true, eventTypes: ['xv'] },
	'editorial-magazine': { portrait: true, eventTypes: ['xv', 'cumple'] },
	'premiere-floral': { portrait: true, eventTypes: ['xv'] },
	'celestial-blue': { portrait: false, eventTypes: ['xv', 'baby-shower'] },
	'enchanted-rose': { portrait: false, eventTypes: ['xv'] },
	'sacred-keepsake': { portrait: true, eventTypes: ['bautizo'] },
	'angelic-presence': { portrait: true, eventTypes: ['bautizo', 'primera-comunion'] },
	'storybook-lilac': { portrait: false, eventTypes: ['xv'] },
} as const satisfies Record<string, ThemePresetMetadata>;

/**
 * The primary identifier for an invitation theme.
 */
export type ThemePreset = keyof typeof THEME_PRESET_METADATA;

export const THEME_PRESETS = Object.keys(THEME_PRESET_METADATA) as [ThemePreset, ...ThemePreset[]];

// ==========================================
// THEME CAPABILITIES
// ==========================================

/** Themes whose hero section renders `hero.portrait` visibly. */
export const PORTRAIT_SUPPORTED_THEMES: ReadonlySet<ThemePreset> = new Set(
	THEME_PRESETS.filter((preset) => THEME_PRESET_METADATA[preset].portrait),
);

/** Presets verified for one event type, in table order. */
export function listThemePresetsForEventType(eventType: EventType): ThemePreset[] {
	return THEME_PRESETS.filter((preset) =>
		(THEME_PRESET_METADATA[preset].eventTypes as readonly EventType[]).includes(eventType),
	);
}

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

export type InvitationRevealRecipe =
	'none' | 'fade' | 'fade-up' | 'media-scale' | 'stagger-group' | 'editorial';

/**
 * Opt-in invitation motion modes (`theme.motion`). `editorial` observes each marked item once and
 * choreographs label, title words, lede, media and items; absent, every invitation keeps its
 * per-section recipes.
 */
export const THEME_MOTION_MODES = ['editorial'] as const;

export type ThemeMotionMode = (typeof THEME_MOTION_MODES)[number];

export const SECTION_INTERSECTION_FAMILIES = [
	'neutral',
	'arch',
	'overlap',
	'atmospheric-blend',
	'pattern-band',
	'folio',
	'stack',
] as const;

export type SectionIntersectionFamily = (typeof SECTION_INTERSECTION_FAMILIES)[number];

/**
 * Decorative line-art sets that sections pick up at fixed positions (heading emblems, rule
 * separators, closing horizon). Purely presentational: CSS pseudo-elements, aria-hidden by nature.
 */
export const SECTION_ORNAMENT_SETS = ['seaside-lineart', 'storybook-lanterns'] as const;
