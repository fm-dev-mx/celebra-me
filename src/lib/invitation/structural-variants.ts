import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/theme-contract';

/**
 * Section-owned structural contracts. These identifiers describe markup or
 * layout behavior; they are intentionally not part of the theme preset union.
 */
export const HERO_STRUCTURAL_VARIANTS = ['standard', 'editorial-cover', 'split-cover'] as const;
export type HeroStructuralVariant = (typeof HERO_STRUCTURAL_VARIANTS)[number];

export const THANK_YOU_STRUCTURAL_VARIANTS = [
	'standard',
	'editorial-back-cover',
	'full-bleed-photo',
] as const;
export type ThankYouStructuralVariant = (typeof THANK_YOU_STRUCTURAL_VARIANTS)[number];

export const GIFTS_STRUCTURAL_VARIANTS = ['standard', 'editorial-catalog'] as const;
export type GiftsStructuralVariant = (typeof GIFTS_STRUCTURAL_VARIANTS)[number];

export const RSVP_STRUCTURAL_VARIANTS = ['standard', 'editorial-press-pass'] as const;
export type RsvpStructuralVariant = (typeof RSVP_STRUCTURAL_VARIANTS)[number];

export const PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS = [
	'standard',
	'ornamented',
	'editorial-pass',
] as const;
export type PersonalizedAccessStructuralVariant =
	(typeof PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS)[number];

export const FAMILY_STRUCTURAL_VARIANTS = ['standard', 'split-groups'] as const;
export type FamilyStructuralVariant = (typeof FAMILY_STRUCTURAL_VARIANTS)[number];

export const LOCATION_STRUCTURAL_VARIANTS = ['standard', 'split-map'] as const;
export type LocationStructuralVariant = (typeof LOCATION_STRUCTURAL_VARIANTS)[number];

/** Gallery owns a layout contract; `variant` is not a theme identity. */
export const GALLERY_LAYOUT_VARIANTS = [
	'uniform-grid',
	'editorial-mosaic',
	'magazine-spread',
	'feature-mosaic',
	'index-choreography',
	'single-keepsake',
] as const;
export type GalleryLayoutVariant = (typeof GALLERY_LAYOUT_VARIANTS)[number];

export function resolveHeroStructuralVariant(
	explicit: string | undefined,
): HeroStructuralVariant {
	if (explicit && (HERO_STRUCTURAL_VARIANTS as readonly string[]).includes(explicit)) {
		return explicit as HeroStructuralVariant;
	}
	return 'standard';
}

export function resolveFamilyStructuralVariant(
	explicit: string | undefined,
): FamilyStructuralVariant {
	if (explicit && (FAMILY_STRUCTURAL_VARIANTS as readonly string[]).includes(explicit)) {
		return explicit as FamilyStructuralVariant;
	}
	return 'standard';
}

export function resolveLocationStructuralVariant(
	explicit: string | undefined,
): LocationStructuralVariant {
	if (explicit && (LOCATION_STRUCTURAL_VARIANTS as readonly string[]).includes(explicit)) {
		return explicit as LocationStructuralVariant;
	}
	return 'standard';
}

export function resolveThankYouStructuralVariant(
	explicit: string | undefined,
): ThankYouStructuralVariant {
	if (explicit && (THANK_YOU_STRUCTURAL_VARIANTS as readonly string[]).includes(explicit)) {
		return explicit as ThankYouStructuralVariant;
	}
	return 'standard';
}

export function resolveGiftsStructuralVariant(
	explicit: string | undefined,
): GiftsStructuralVariant {
	if (explicit && (GIFTS_STRUCTURAL_VARIANTS as readonly string[]).includes(explicit)) {
		return explicit as GiftsStructuralVariant;
	}
	return 'standard';
}

export function resolveRsvpStructuralVariant(
	explicit: string | undefined,
): RsvpStructuralVariant {
	if (explicit && (RSVP_STRUCTURAL_VARIANTS as readonly string[]).includes(explicit)) {
		return explicit as RsvpStructuralVariant;
	}
	return 'standard';
}

export function resolvePersonalizedAccessStructuralVariant(
	explicit: string | undefined,
): PersonalizedAccessStructuralVariant {
	if (
		explicit &&
		(PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS as readonly string[]).includes(explicit)
	) {
		return explicit as PersonalizedAccessStructuralVariant;
	}
	return 'standard';
}

/**
 * Resolve gallery layout from an explicit layout ID on `gallery.variant`.
 * The only remaining content alias is `single` → `single-keepsake`.
 * Theme names are visual skins via `resolveGalleryVisualVariant`, not layouts.
 */
export function resolveGalleryLayoutVariant(
	explicit: string | undefined,
	legacyVariant?: string | undefined,
): GalleryLayoutVariant {
	if (explicit && (GALLERY_LAYOUT_VARIANTS as readonly string[]).includes(explicit)) {
		return explicit as GalleryLayoutVariant;
	}
	if (explicit === 'single' || legacyVariant === 'single') return 'single-keepsake';
	return 'uniform-grid';
}

/** Explicit gallery layout aliases are rendered with the legacy skin when needed. */
export function resolveGalleryVisualVariant(
	legacyVariant: string | undefined,
	themePreset: ThemePreset,
): ThemePreset | 'single' {
	if (legacyVariant === 'single' || legacyVariant === 'single-keepsake') return 'single';
	if (legacyVariant && (THEME_PRESETS as readonly string[]).includes(legacyVariant)) {
		return legacyVariant as ThemePreset;
	}
	return themePreset;
}
