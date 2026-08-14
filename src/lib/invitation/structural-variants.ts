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

export const FAMILY_STRUCTURAL_VARIANTS = [
	'standard',
	'split-groups',
	'asymmetric-groups',
] as const;
export type FamilyStructuralVariant = (typeof FAMILY_STRUCTURAL_VARIANTS)[number];

export const LOCATION_STRUCTURAL_VARIANTS = [
	'standard',
	'split-map',
	'stacked-venue-plates',
] as const;
export type LocationStructuralVariant = (typeof LOCATION_STRUCTURAL_VARIANTS)[number];

/** Gallery owns a layout contract; `variant` is not a theme identity. */
export const GALLERY_LAYOUT_VARIANTS = [
	'uniform-grid',
	'editorial-mosaic',
	'magazine-spread',
	'feature-mosaic',
	'feature-stack',
	'paired-feature-band',
	'index-choreography',
	'single-keepsake',
] as const;
export type GalleryLayoutVariant = (typeof GALLERY_LAYOUT_VARIANTS)[number];

/** Itinerary structural behaviors (renderer / layout selection). */
export const ITINERARY_STRUCTURAL_VARIANTS = [
	'standard',
	'timeline-paper',
	'editorial-ledger',
	'editorial-program',
] as const;
