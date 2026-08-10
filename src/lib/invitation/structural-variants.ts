import { THEME_PRESETS, type ThemePreset } from '@/lib/theme/theme-contract';

/**
 * Section-owned structural contracts. These identifiers describe markup or
 * layout behavior; they are intentionally not part of the theme preset union.
 */
export const HERO_STRUCTURAL_VARIANTS = ['standard', 'editorial-cover'] as const;
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
	themePreset: ThemePreset,
): HeroStructuralVariant {
	if (explicit && (HERO_STRUCTURAL_VARIANTS as readonly string[]).includes(explicit)) {
		return explicit as HeroStructuralVariant;
	}
	return themePreset === 'editorial-magazine' ? 'editorial-cover' : 'standard';
}

export function resolveThankYouStructuralVariant(
	explicit: string | undefined,
	themePreset: ThemePreset,
): ThankYouStructuralVariant {
	if (explicit && (THANK_YOU_STRUCTURAL_VARIANTS as readonly string[]).includes(explicit)) {
		return explicit as ThankYouStructuralVariant;
	}
	if (themePreset === 'sacred-keepsake') return 'full-bleed-photo';
	if (
		themePreset === 'celestial-blue' ||
		themePreset === 'enchanted-rose' ||
		themePreset === 'editorial-magazine'
	) {
		return 'editorial-back-cover';
	}
	return 'standard';
}

export function resolveGiftsStructuralVariant(
	explicit: string | undefined,
	themePreset: ThemePreset,
): GiftsStructuralVariant {
	if (explicit && (GIFTS_STRUCTURAL_VARIANTS as readonly string[]).includes(explicit)) {
		return explicit as GiftsStructuralVariant;
	}
	return themePreset === 'editorial-magazine' ? 'editorial-catalog' : 'standard';
}

export function resolveRsvpStructuralVariant(
	explicit: string | undefined,
	themePreset: ThemePreset,
): RsvpStructuralVariant {
	if (explicit && (RSVP_STRUCTURAL_VARIANTS as readonly string[]).includes(explicit)) {
		return explicit as RsvpStructuralVariant;
	}
	return themePreset === 'editorial-magazine' ? 'editorial-press-pass' : 'standard';
}

export function resolvePersonalizedAccessStructuralVariant(
	explicit: string | undefined,
	themePreset: ThemePreset,
): PersonalizedAccessStructuralVariant {
	if (
		explicit &&
		(PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS as readonly string[]).includes(explicit)
	) {
		return explicit as PersonalizedAccessStructuralVariant;
	}
	if (themePreset === 'editorial-magazine') return 'editorial-pass';
	return themePreset === 'jewelry-box' ? 'standard' : 'ornamented';
}

export function resolveGalleryLayoutVariant(
	explicit: string | undefined,
	legacyVariant: string | undefined,
	themePreset: ThemePreset,
): GalleryLayoutVariant {
	if (explicit && (GALLERY_LAYOUT_VARIANTS as readonly string[]).includes(explicit)) {
		return explicit as GalleryLayoutVariant;
	}
	const legacy = legacyVariant ?? themePreset;
	if (legacy === 'single') return 'single-keepsake';
	if (legacy === 'editorial-magazine') return 'magazine-spread';
	if (legacy === 'celestial-blue') return 'index-choreography';
	if (legacy === 'luxury-hacienda' || legacy === 'enchanted-rose' || legacy === 'jewelry-box') {
		return 'feature-mosaic';
	}
	if (legacy === 'editorial' || legacy === 'editorial-rose' || legacy === 'premiere-floral') {
		return 'editorial-mosaic';
	}
	return 'uniform-grid';
}

/** Explicit gallery layout aliases are rendered with the legacy skin when needed. */
export function resolveGalleryVisualVariant(
	legacyVariant: string | undefined,
	themePreset: ThemePreset,
): ThemePreset | 'single' {
	if (legacyVariant === 'single') return 'single';
	if (legacyVariant && (THEME_PRESETS as readonly string[]).includes(legacyVariant)) {
		return legacyVariant as ThemePreset;
	}
	return themePreset;
}
