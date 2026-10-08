/**
 * Canonical section-variant registry.
 *
 * A section owns its variant. Theme presets provide atmosphere tokens only;
 * they never select or infer a section variant. The registry is also the
 * source for section CSS ownership metadata.
 */

export type CanonicalVariantSection =
	| 'hero'
	| 'family'
	| 'location'
	| 'itinerary'
	| 'gallery'
	| 'gifts'
	| 'rsvp'
	| 'personalizedAccess'
	| 'thankYou'
	| 'countdown'
	| 'memories';

export type CanonicalVariantCssOwner =
	`src/styles/themes/sections/${string}` | `section-base:${string}`;

export type CanonicalVariantRegistryEntry = {
	section: CanonicalVariantSection;
	variant: string;
	default: boolean;
	prerequisites: readonly string[];
	cssOwner: CanonicalVariantCssOwner;
};

const noSpecialPrerequisites = ['Canonical section payload'] as const;

const canonicalVariantRegistry: readonly CanonicalVariantRegistryEntry[] = [
	{
		section: 'hero',
		variant: 'ceremonial-portrait',
		default: false,
		prerequisites: ['Canonical section payload; optional ceremonial ornament'],
		cssOwner: 'src/styles/themes/sections/hero/_ceremonial-portrait.scss',
	},
	{
		section: 'hero',
		variant: 'framed-portrait',
		default: false,
		prerequisites: ['hero.backgroundImage'],
		cssOwner: 'src/styles/themes/sections/hero/_framed-portrait.scss',
	},
	{
		section: 'hero',
		variant: 'bleed-portrait',
		default: false,
		prerequisites: ['hero.backgroundImage'],
		cssOwner: 'src/styles/themes/sections/hero/_bleed-portrait.scss',
	},
	{
		section: 'gallery',
		variant: 'narrative-stack',
		default: false,
		prerequisites: ['gallery.items with at least one image and a non-empty caption per item'],
		cssOwner: 'src/styles/themes/sections/gallery/_narrative-stack.scss',
	},
	{
		section: 'hero',
		variant: 'standard',
		default: true,
		prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:hero',
	},
	{
		section: 'hero',
		variant: 'editorial-cover',
		default: false,
		prerequisites: ['hero.backgroundImage'],
		cssOwner: 'src/styles/themes/sections/hero/_editorial-cover.scss',
	},
	{
		section: 'hero',
		variant: 'split-cover',
		default: false,
		prerequisites: ['hero.backgroundImage', 'hero.portrait'],
		cssOwner: 'src/styles/themes/sections/hero/_split-cover.scss',
	},
	{
		section: 'family',
		variant: 'standard',
		default: true,
		prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:family',
	},
	{
		section: 'family',
		variant: 'split-groups',
		default: false,
		prerequisites: ['family.groups with at least two groups'],
		cssOwner: 'src/styles/themes/sections/family/_split-groups.scss',
	},
	{
		section: 'family',
		variant: 'asymmetric-groups',
		default: false,
		prerequisites: ['family.groups with at least two groups'],
		cssOwner: 'src/styles/themes/sections/family/_asymmetric-groups.scss',
	},
	{
		section: 'location',
		variant: 'standard',
		default: true,
		prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:location',
	},
	{
		section: 'location',
		variant: 'split-map',
		default: false,
		prerequisites: ['At least one visible venue with coordinates or image media'],
		cssOwner: 'src/styles/themes/sections/location/_split-map.scss',
	},
	{
		section: 'location',
		variant: 'stacked-venue-plates',
		default: false,
		prerequisites: ['At least two visible venues'],
		cssOwner: 'src/styles/themes/sections/location/_stacked-venue-plates.scss',
	},
	{
		section: 'location',
		variant: 'program-sheet',
		default: false,
		prerequisites: ['At least one visible venue'],
		cssOwner: 'src/styles/themes/sections/location/_program-sheet.scss',
	},
	{
		section: 'itinerary',
		variant: 'standard',
		default: true,
		prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:itinerary',
	},
	{
		section: 'itinerary',
		variant: 'timeline-paper',
		default: false,
		prerequisites: ['itinerary.items'],
		cssOwner: 'src/styles/themes/sections/itinerary/_timeline-paper.scss',
	},
	{
		section: 'itinerary',
		variant: 'editorial-ledger',
		default: false,
		prerequisites: ['itinerary.items'],
		cssOwner: 'src/styles/themes/sections/itinerary/_editorial-ledger.scss',
	},
	{
		section: 'itinerary',
		variant: 'editorial-program',
		default: false,
		prerequisites: ['itinerary.items'],
		cssOwner: 'src/styles/themes/sections/itinerary/_editorial-program.scss',
	},
	{
		section: 'gallery',
		variant: 'uniform-grid',
		default: true,
		prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:gallery',
	},
	{
		section: 'gallery',
		variant: 'editorial-mosaic',
		default: false,
		prerequisites: ['gallery.items'],
		cssOwner: 'src/styles/themes/sections/gallery/_editorial-mosaic.scss',
	},
	{
		section: 'gallery',
		variant: 'magazine-spread',
		default: false,
		prerequisites: ['gallery.items'],
		cssOwner: 'src/styles/themes/sections/gallery/_magazine-spread.scss',
	},
	{
		section: 'gallery',
		variant: 'feature-mosaic',
		default: false,
		prerequisites: ['gallery.items'],
		cssOwner: 'src/styles/themes/sections/gallery/_feature-mosaic.scss',
	},
	{
		section: 'gallery',
		variant: 'feature-stack',
		default: false,
		prerequisites: ['gallery.items with at least three items'],
		cssOwner: 'src/styles/themes/sections/gallery/_feature-stack.scss',
	},
	{
		section: 'gallery',
		variant: 'paired-feature-band',
		default: false,
		prerequisites: ['gallery.items with at least three items and one feature role'],
		cssOwner: 'src/styles/themes/sections/gallery/_paired-feature-band.scss',
	},
	{
		section: 'gallery',
		variant: 'index-choreography',
		default: false,
		prerequisites: ['gallery.items'],
		cssOwner: 'src/styles/themes/sections/gallery/_index-choreography.scss',
	},
	{
		section: 'gallery',
		variant: 'mirrored-mosaic',
		default: false,
		prerequisites: ['gallery.items with at least three images'],
		cssOwner: 'src/styles/themes/sections/gallery/_mirrored-mosaic.scss',
	},
	{
		section: 'gallery',
		variant: 'single-keepsake',
		default: false,
		prerequisites: ['gallery.items with exactly one item'],
		cssOwner: 'src/styles/themes/sections/gallery/_single-keepsake.scss',
	},
	{
		section: 'gifts',
		variant: 'standard',
		default: true,
		prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:gifts',
	},
	{
		section: 'gifts',
		variant: 'editorial-catalog',
		default: false,
		prerequisites: ['gifts.items or an explicit compatible presentation'],
		cssOwner: 'src/styles/themes/sections/gifts/_editorial-catalog.scss',
	},
	{
		section: 'rsvp',
		variant: 'standard',
		default: true,
		prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'section-base:rsvp',
	},
	{
		section: 'rsvp',
		variant: 'editorial-press-pass',
		default: false,
		prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'src/styles/themes/sections/rsvp/_editorial-press-pass.scss',
	},
	{
		section: 'rsvp',
		variant: 'reply-card',
		default: false,
		prerequisites: noSpecialPrerequisites,
		cssOwner: 'src/styles/themes/sections/rsvp/_reply-card.scss',
	},
	{
		section: 'rsvp',
		variant: 'formal-register',
		default: false,
		prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'src/styles/themes/sections/rsvp/_formal-register.scss',
	},
	{
		section: 'personalizedAccess',
		variant: 'standard',
		default: true,
		prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'section-base:personalized-access',
	},
	{
		section: 'personalizedAccess',
		variant: 'ornamented',
		default: false,
		prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'src/styles/themes/sections/personalized-access/_ornamented.scss',
	},
	{
		section: 'personalizedAccess',
		variant: 'editorial-pass',
		default: false,
		prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'src/styles/themes/sections/personalized-access/_editorial-pass.scss',
	},
	{
		section: 'personalizedAccess',
		variant: 'reply-card',
		default: false,
		prerequisites: noSpecialPrerequisites,
		cssOwner: 'src/styles/themes/sections/personalized-access/_reply-card.scss',
	},
	{
		section: 'personalizedAccess',
		variant: 'formal-pass',
		default: false,
		prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'src/styles/themes/sections/personalized-access/_formal-pass.scss',
	},
	{
		section: 'thankYou',
		variant: 'standard',
		default: true,
		prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:thank-you',
	},
	{
		section: 'thankYou',
		variant: 'editorial-back-cover',
		default: false,
		prerequisites: ['thankYou.message', 'thankYou.closingName'],
		cssOwner: 'src/styles/themes/sections/thank-you/_editorial-back-cover.scss',
	},
	{
		section: 'thankYou',
		variant: 'portrait-letter',
		default: false,
		prerequisites: ['thankYou.message', 'thankYou.closingName', 'thankYou.image'],
		cssOwner: 'src/styles/themes/sections/thank-you/_portrait-letter.scss',
	},
	{
		section: 'thankYou',
		variant: 'portrait-keepsake',
		default: false,
		prerequisites: ['thankYou.message', 'thankYou.closingName', 'thankYou.image'],
		cssOwner: 'src/styles/themes/sections/thank-you/_portrait-keepsake.scss',
	},
	{
		section: 'thankYou',
		variant: 'full-bleed-photo',
		default: false,
		prerequisites: ['thankYou.image'],
		cssOwner: 'src/styles/themes/sections/thank-you/_full-bleed-photo.scss',
	},
	{
		section: 'countdown',
		variant: 'standard',
		default: true,
		prerequisites: ['countdown'],
		cssOwner: 'section-base:countdown',
	},
	{
		section: 'countdown',
		variant: 'editorial-folio',
		default: false,
		prerequisites: ['countdown'],
		cssOwner: 'src/styles/themes/sections/countdown/_editorial-folio.scss',
	},
	{
		section: 'countdown',
		variant: 'magazine-folio',
		default: false,
		prerequisites: ['countdown'],
		cssOwner: 'src/styles/themes/sections/countdown/_magazine-folio.scss',
	},
	{
		section: 'countdown',
		variant: 'written-days',
		default: false,
		prerequisites: noSpecialPrerequisites,
		cssOwner: 'src/styles/themes/sections/countdown/_written-days.scss',
	},
	{
		section: 'countdown',
		variant: 'clock-face',
		default: false,
		prerequisites: ['countdown'],
		cssOwner: 'src/styles/themes/sections/countdown/_clock-face.scss',
	},
	{
		section: 'gallery',
		variant: 'paired-portraits',
		default: false,
		prerequisites: ['Two complete gallery images'],
		cssOwner: 'src/styles/themes/sections/gallery/_paired-portraits.scss',
	},
	{
		section: 'thankYou',
		variant: 'ceremonial-closing',
		default: false,
		prerequisites: ['Closing copy; optional decorative image'],
		cssOwner: 'src/styles/themes/sections/thank-you/_ceremonial-closing.scss',
	},
	{
		section: 'family',
		variant: 'ceremonial-family',
		default: false,
		prerequisites: ['Family names'],
		cssOwner: 'src/styles/themes/sections/family/_ceremonial-family.scss',
	},
	{
		section: 'memories',
		variant: 'card',
		default: false,
		prerequisites: ['memories.publicSlug'],
		cssOwner: 'src/styles/themes/sections/memories/_card.scss',
	},
] as const satisfies readonly CanonicalVariantRegistryEntry[];

export const CANONICAL_VARIANT_REGISTRY = canonicalVariantRegistry;

function variantsFor<Section extends CanonicalVariantSection>(section: Section) {
	return canonicalVariantRegistry
		.filter((entry) => entry.section === section)
		.map((entry) => entry.variant) as unknown as readonly [string, ...string[]];
}

// Values remain derived from the registry; tuple casts preserve z.enum's
// literal input contract without introducing another value registry.
export const HERO_VARIANTS = variantsFor('hero');
export type HeroVariant = (typeof HERO_VARIANTS)[number];
export const FAMILY_VARIANTS = variantsFor('family');
export type FamilyVariant = (typeof FAMILY_VARIANTS)[number];
export const LOCATION_VARIANTS = variantsFor('location');
export type LocationVariant = (typeof LOCATION_VARIANTS)[number];
export const ITINERARY_VARIANTS = variantsFor('itinerary');
export type ItineraryVariant = (typeof ITINERARY_VARIANTS)[number];
export const GALLERY_VARIANTS = variantsFor('gallery');
export type GalleryVariant = (typeof GALLERY_VARIANTS)[number];
export const GIFTS_VARIANTS = variantsFor('gifts');
export type GiftsVariant = (typeof GIFTS_VARIANTS)[number];
export const RSVP_VARIANTS = variantsFor('rsvp');
export type RsvpVariant = (typeof RSVP_VARIANTS)[number];
export const PERSONALIZED_ACCESS_VARIANTS = variantsFor('personalizedAccess');
export type PersonalizedAccessVariant = (typeof PERSONALIZED_ACCESS_VARIANTS)[number];
export const THANK_YOU_VARIANTS = variantsFor('thankYou');
export type ThankYouVariant = (typeof THANK_YOU_VARIANTS)[number];
export const COUNTDOWN_VARIANTS = variantsFor('countdown');
export type CountdownVariant = (typeof COUNTDOWN_VARIANTS)[number];
export const MEMORIES_VARIANTS = variantsFor('memories');
export type MemoriesVariant = (typeof MEMORIES_VARIANTS)[number];

/** Sections without a layout/skin choice emit this closed value. */
export const STANDARD_SECTION_VARIANTS = ['standard'] as const;
export type StandardSectionVariant = (typeof STANDARD_SECTION_VARIANTS)[number];
export type QuoteVariant = StandardSectionVariant;
export type SharedSectionVariant = StandardSectionVariant;
