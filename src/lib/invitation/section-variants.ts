/**
 * Canonical section-variant registry.
 *
 * A section owns its variant. Theme presets provide atmosphere tokens only;
 * they never select or infer a section variant. The registry is also the
 * source for the cutover manifest and section CSS ownership metadata.
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
	| 'countdown';

export type CanonicalVariantCssOwner =
	| `src/styles/themes/sections/${string}`
	| `section-base:${string}`;

export type CanonicalVariantRegistryEntry = {
	section: CanonicalVariantSection;
	variant: string;
	default: boolean;
	prerequisites: readonly string[];
	cssOwner: CanonicalVariantCssOwner;
	/** Null for defaults; otherwise records the unresolved baseline gate. */
	unresolvedVisualVerification: string | null;
	/** Required persisted-content operation before deployment. */
	requiredPersistedContentTransformation: string;
};

const PENDING_VISUAL_BASELINE =
	'Structural gate passed; accepted baseline pending authorized assets and human approval.';

const noSpecialPrerequisites = ['Canonical section payload'] as const;

const canonicalVariantRegistry: readonly CanonicalVariantRegistryEntry[] = [
	{
		section: 'hero', variant: 'standard', default: true, prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:hero', unresolvedVisualVerification: null,
		requiredPersistedContentTransformation: 'No transformation required.',
	},
	{
		section: 'hero', variant: 'editorial-cover', default: false,
		prerequisites: ['hero.backgroundImage'], cssOwner: 'src/styles/themes/sections/hero/_editorial-cover.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set hero.variant to editorial-cover and remove legacy variant fields.',
	},
	{
		section: 'hero', variant: 'split-cover', default: false,
		prerequisites: ['hero.backgroundImage', 'hero.portrait'], cssOwner: 'src/styles/themes/sections/hero/_split-cover.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set hero.variant to split-cover and remove legacy variant fields.',
	},
	{
		section: 'family', variant: 'standard', default: true, prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:family', unresolvedVisualVerification: null,
		requiredPersistedContentTransformation: 'No transformation required.',
	},
	{
		section: 'family', variant: 'split-groups', default: false,
		prerequisites: ['family.groups with at least two groups'], cssOwner: 'src/styles/themes/sections/family/_split-groups.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set family.variant to split-groups and persist family.groups.',
	},
	{
		section: 'family', variant: 'asymmetric-groups', default: false,
		prerequisites: ['family.groups with at least two groups'], cssOwner: 'src/styles/themes/sections/family/_asymmetric-groups.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set family.variant to asymmetric-groups and persist family.groups.',
	},
	{
		section: 'location', variant: 'standard', default: true, prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:location', unresolvedVisualVerification: null,
		requiredPersistedContentTransformation: 'No transformation required.',
	},
	{
		section: 'location', variant: 'split-map', default: false,
		prerequisites: ['At least one visible venue with coordinates or image media'], cssOwner: 'src/styles/themes/sections/location/_split-map.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set location.variant to split-map and persist a compatible venue.',
	},
	{
		section: 'location', variant: 'stacked-venue-plates', default: false,
		prerequisites: ['At least two visible venues'], cssOwner: 'src/styles/themes/sections/location/_stacked-venue-plates.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set location.variant to stacked-venue-plates and persist two visible venues.',
	},
	{
		section: 'itinerary', variant: 'standard', default: true, prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:itinerary', unresolvedVisualVerification: null,
		requiredPersistedContentTransformation: 'No transformation required.',
	},
	{
		section: 'itinerary', variant: 'timeline-paper', default: false,
		prerequisites: ['itinerary.items'], cssOwner: 'src/styles/themes/sections/itinerary/_timeline-paper.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set itinerary.variant to timeline-paper and remove legacy presentation aliases.',
	},
	{
		section: 'itinerary', variant: 'editorial-ledger', default: false,
		prerequisites: ['itinerary.items'], cssOwner: 'src/styles/themes/sections/itinerary/_editorial-ledger.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set itinerary.variant to editorial-ledger and remove legacy presentation aliases.',
	},
	{
		section: 'itinerary', variant: 'editorial-program', default: false,
		prerequisites: ['itinerary.items'], cssOwner: 'src/styles/themes/sections/itinerary/_editorial-program.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set itinerary.variant to editorial-program and remove legacy presentation aliases.',
	},
	{
		section: 'gallery', variant: 'uniform-grid', default: true, prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:gallery', unresolvedVisualVerification: null,
		requiredPersistedContentTransformation: 'No transformation required.',
	},
	{
		section: 'gallery', variant: 'editorial-mosaic', default: false,
		prerequisites: ['gallery.items'], cssOwner: 'src/styles/themes/sections/gallery/_editorial-mosaic.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set gallery.variant to editorial-mosaic and persist gallery.items.',
	},
	{
		section: 'gallery', variant: 'magazine-spread', default: false,
		prerequisites: ['gallery.items'], cssOwner: 'src/styles/themes/sections/gallery/_magazine-spread.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set gallery.variant to magazine-spread and persist gallery.items.',
	},
	{
		section: 'gallery', variant: 'feature-mosaic', default: false,
		prerequisites: ['gallery.items'], cssOwner: 'src/styles/themes/sections/gallery/_feature-mosaic.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set gallery.variant to feature-mosaic and persist gallery.items.',
	},
	{
		section: 'gallery', variant: 'feature-stack', default: false,
		prerequisites: ['gallery.items with at least three items'], cssOwner: 'src/styles/themes/sections/gallery/_feature-stack.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set gallery.variant to feature-stack and persist at least three gallery.items.',
	},
	{
		section: 'gallery', variant: 'paired-feature-band', default: false,
		prerequisites: ['gallery.items with at least three items and one feature role'], cssOwner: 'src/styles/themes/sections/gallery/_paired-feature-band.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set gallery.variant to paired-feature-band and persist compatible item roles.',
	},
	{
		section: 'gallery', variant: 'index-choreography', default: false,
		prerequisites: ['gallery.items'], cssOwner: 'src/styles/themes/sections/gallery/_index-choreography.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set gallery.variant to index-choreography and persist gallery.items.',
	},
	{
		section: 'gallery', variant: 'single-keepsake', default: false,
		prerequisites: ['gallery.items with exactly one item'], cssOwner: 'src/styles/themes/sections/gallery/_single-keepsake.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set gallery.variant to single-keepsake and persist exactly one gallery item.',
	},
	{
		section: 'gifts', variant: 'standard', default: true, prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:gifts', unresolvedVisualVerification: null,
		requiredPersistedContentTransformation: 'No transformation required.',
	},
	{
		section: 'gifts', variant: 'editorial-catalog', default: false,
		prerequisites: ['gifts.items or an explicit compatible presentation'], cssOwner: 'src/styles/themes/sections/gifts/_editorial-catalog.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set gifts.variant to editorial-catalog and remove legacy variant fields.',
	},
	{
		section: 'rsvp', variant: 'standard', default: true, prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'section-base:rsvp', unresolvedVisualVerification: null,
		requiredPersistedContentTransformation: 'No transformation required.',
	},
	{
		section: 'rsvp', variant: 'editorial-press-pass', default: false, prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'src/styles/themes/sections/rsvp/_editorial-press-pass.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set rsvp.variant to editorial-press-pass and remove legacy variant fields.',
	},
	{
		section: 'rsvp', variant: 'formal-register', default: false, prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'src/styles/themes/sections/rsvp/_formal-register.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set rsvp.variant to formal-register and remove legacy variant fields.',
	},
	{
		section: 'personalizedAccess', variant: 'standard', default: true, prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'section-base:personalized-access', unresolvedVisualVerification: null,
		requiredPersistedContentTransformation: 'No transformation required.',
	},
	{
		section: 'personalizedAccess', variant: 'ornamented', default: false, prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'src/styles/themes/sections/personalized-access/_ornamented.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set rsvp.personalizedAccess.variant to ornamented and remove legacy variant fields.',
	},
	{
		section: 'personalizedAccess', variant: 'editorial-pass', default: false, prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'src/styles/themes/sections/personalized-access/_editorial-pass.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set rsvp.personalizedAccess.variant to editorial-pass and remove legacy variant fields.',
	},
	{
		section: 'personalizedAccess', variant: 'formal-pass', default: false, prerequisites: ['rsvp.personalizedAccess'],
		cssOwner: 'src/styles/themes/sections/personalized-access/_formal-pass.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set rsvp.personalizedAccess.variant to formal-pass and remove legacy variant fields.',
	},
	{
		section: 'thankYou', variant: 'standard', default: true, prerequisites: noSpecialPrerequisites,
		cssOwner: 'section-base:thank-you', unresolvedVisualVerification: null,
		requiredPersistedContentTransformation: 'No transformation required.',
	},
	{
		section: 'thankYou', variant: 'editorial-back-cover', default: false,
		prerequisites: ['thankYou.message', 'thankYou.closingName'], cssOwner: 'src/styles/themes/sections/thank-you/_editorial-back-cover.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set thankYou.variant to editorial-back-cover and remove legacy variant fields.',
	},
	{
		section: 'thankYou', variant: 'full-bleed-photo', default: false,
		prerequisites: ['thankYou.image'], cssOwner: 'src/styles/themes/sections/thank-you/_full-bleed-photo.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set thankYou.variant to full-bleed-photo and persist thankYou.image.',
	},
	{
		section: 'countdown', variant: 'standard', default: true, prerequisites: ['countdown'],
		cssOwner: 'section-base:countdown', unresolvedVisualVerification: null,
		requiredPersistedContentTransformation: 'No transformation required.',
	},
	{
		section: 'countdown', variant: 'editorial-folio', default: false, prerequisites: ['countdown'],
		cssOwner: 'src/styles/themes/sections/countdown/_editorial-folio.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set countdown.variant to editorial-folio and remove legacy variant fields.',
	},
	{
		section: 'countdown', variant: 'magazine-folio', default: false, prerequisites: ['countdown'],
		cssOwner: 'src/styles/themes/sections/countdown/_magazine-folio.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set countdown.variant to magazine-folio and remove legacy variant fields.',
	},
	{
		section: 'countdown', variant: 'jeweled-panel', default: false, prerequisites: ['countdown'],
		cssOwner: 'src/styles/themes/sections/countdown/_jeweled-panel.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set countdown.variant to jeweled-panel and remove legacy variant fields.',
	},
	{
		section: 'countdown', variant: 'rose-ornament', default: false, prerequisites: ['countdown'],
		cssOwner: 'src/styles/themes/sections/countdown/_rose-ornament.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set countdown.variant to rose-ornament and remove legacy variant fields.',
	},
	{
		section: 'countdown', variant: 'hacienda-ornament', default: false, prerequisites: ['countdown'],
		cssOwner: 'src/styles/themes/sections/countdown/_hacienda-ornament.scss',
		unresolvedVisualVerification: PENDING_VISUAL_BASELINE,
		requiredPersistedContentTransformation: 'Set countdown.variant to hacienda-ornament and remove legacy variant fields.',
	},
] as const satisfies readonly CanonicalVariantRegistryEntry[];

export const CANONICAL_VARIANT_REGISTRY = canonicalVariantRegistry;
export const CANONICAL_VARIANT_CUTOVER_MANIFEST = canonicalVariantRegistry.filter(
	(entry) => !entry.default,
);

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

/** Sections without a layout/skin choice emit this closed value. */
export const STANDARD_SECTION_VARIANTS = ['standard'] as const;
export type StandardSectionVariant = (typeof STANDARD_SECTION_VARIANTS)[number];
export type QuoteVariant = StandardSectionVariant;
export type SharedSectionVariant = StandardSectionVariant;
