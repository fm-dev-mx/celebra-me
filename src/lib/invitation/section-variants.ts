/**
 * Canonical section variants. These identifiers define the structural/layout
 * behavior for each section across all event types.
 *
 * Theme Presets (.theme-preset--*) provide atmosphere tokens (colors, fonts, radii).
 * Section Variants (.section[data-variant='...']) provide structure and layout.
 */

// Hero
export const HERO_VARIANTS = ['standard', 'editorial-cover', 'split-cover'] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];

// Family
export const FAMILY_VARIANTS = [
	'standard',
	'split-groups',
	'asymmetric-groups',
] as const;
export type FamilyVariant = (typeof FAMILY_VARIANTS)[number];

// Location
export const LOCATION_VARIANTS = [
	'standard',
	'split-map',
	'stacked-venue-plates',
] as const;
export type LocationVariant = (typeof LOCATION_VARIANTS)[number];

// Itinerary
export const ITINERARY_VARIANTS = [
	'standard',
	'timeline-paper',
	'editorial-ledger',
	'editorial-program',
] as const;
export const ITINERARY_BEHAVIOR_VARIANTS = ITINERARY_VARIANTS;
export type ItineraryVariant = (typeof ITINERARY_VARIANTS)[number];

// Gallery
export const GALLERY_VARIANTS = [
	'uniform-grid',
	'editorial-mosaic',
	'magazine-spread',
	'feature-mosaic',
	'feature-stack',
	'paired-feature-band',
	'index-choreography',
	'single-keepsake',
] as const;
export type GalleryVariant = (typeof GALLERY_VARIANTS)[number];

// Gifts
export const GIFTS_VARIANTS = ['standard', 'editorial-catalog'] as const;
export type GiftsVariant = (typeof GIFTS_VARIANTS)[number];

// RSVP
export const RSVP_VARIANTS = [
	'standard',
	'editorial-press-pass',
	'formal-register',
] as const;
export type RsvpVariant = (typeof RSVP_VARIANTS)[number];

// Personalized Access
export const PERSONALIZED_ACCESS_VARIANTS = [
	'standard',
	'ornamented',
	'editorial-pass',
	'formal-pass',
] as const;
export type PersonalizedAccessVariant =
	(typeof PERSONALIZED_ACCESS_VARIANTS)[number];

// Thank You
export const THANK_YOU_VARIANTS = [
	'standard',
	'editorial-back-cover',
	'full-bleed-photo',
] as const;
export type ThankYouVariant = (typeof THANK_YOU_VARIANTS)[number];

// --------------------------------------------------------------------------
// Backward-compatibility aliases (deprecated, to be removed)
// --------------------------------------------------------------------------
export const HERO_STRUCTURAL_VARIANTS = HERO_VARIANTS;
export const FAMILY_STRUCTURAL_VARIANTS = FAMILY_VARIANTS;
export const LOCATION_STRUCTURAL_VARIANTS = LOCATION_VARIANTS;
export const ITINERARY_STRUCTURAL_VARIANTS = ITINERARY_VARIANTS;
export const GALLERY_LAYOUT_VARIANTS = GALLERY_VARIANTS;
export const GIFTS_STRUCTURAL_VARIANTS = GIFTS_VARIANTS;
export const RSVP_STRUCTURAL_VARIANTS = RSVP_VARIANTS;
export const PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS = PERSONALIZED_ACCESS_VARIANTS;
export const THANK_YOU_STRUCTURAL_VARIANTS = THANK_YOU_VARIANTS;
