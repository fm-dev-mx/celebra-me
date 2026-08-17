import type { RenderPlanIntersection, RenderPlanTarget } from './composition-contract';
import {
	GALLERY_LAYOUT_VARIANTS,
	GIFTS_STRUCTURAL_VARIANTS,
	HERO_STRUCTURAL_VARIANTS,
	ITINERARY_STRUCTURAL_VARIANTS,
} from './structural-variants';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';

type JsonRecord = Record<string, unknown>;
type IntersectionProfile = Partial<Record<RenderPlanTarget, RenderPlanIntersection>>;

export interface VariantCompatibilityAlias {
	legacy: string;
	target: string;
	knownConsumers: readonly string[];
	owner: 'variant-input-normalizer';
	retireWhen: string;
}

export interface VariantNormalizationConflict {
	path: string[];
	message: string;
	canonical: unknown;
	legacy: unknown;
}

export class VariantNormalizationConflictError extends Error {
	readonly code = 'variant_normalization_conflict' as const;

	constructor(readonly conflicts: readonly VariantNormalizationConflict[]) {
		super(conflicts.map((conflict) => conflict.message).join('; '));
		this.name = 'VariantNormalizationConflictError';
	}
}

export const VARIANT_COMPATIBILITY_ALIASES: readonly VariantCompatibilityAlias[] = [
	{
		legacy: 'hero.structuralVariant',
		target: 'hero.variant',
		knownConsumers: ['persisted published content', 'legacy fixtures'],
		owner: 'variant-input-normalizer',
		retireWhen: 'all persisted and fixture content carries hero.variant',
	},
	{
		legacy: 'sectionStyles.*.structuralVariant',
		target: 'owning section.variant',
		knownConsumers: ['persisted published content', 'legacy fixtures'],
		owner: 'variant-input-normalizer',
		retireWhen: 'all persisted and fixture content carries section.variant',
	},
	{
		legacy: 'gallery.variant=single',
		target: 'gallery.variant=single-keepsake',
		knownConsumers: ['legacy gallery fixtures'],
		owner: 'variant-input-normalizer',
		retireWhen: 'repository and persisted corpus have zero single aliases',
	},
	{
		legacy: 'gallery.variant=<theme preset>',
		target: 'matching semantic gallery layout + gallery.visualVariant=<theme preset>',
		knownConsumers: ['legacy gallery fixtures'],
		owner: 'variant-input-normalizer',
		retireWhen: 'repository and persisted corpus separate Gallery layout and skin',
	},
	{
		legacy: 'gifts.variant=<theme preset>',
		target: 'gifts.variant=standard or editorial-catalog',
		knownConsumers: ['legacy gift fixtures', 'persisted published content'],
		owner: 'variant-input-normalizer',
		retireWhen: 'repository and persisted corpus use a semantic Gifts variant',
	},
	{
		legacy: 'itinerary.presentation.behavior',
		target: 'itinerary.variant',
		knownConsumers: ['persisted published content', 'legacy fixtures'],
		owner: 'variant-input-normalizer',
		retireWhen: 'all persisted and fixture content carries itinerary.variant',
	},
	{
		legacy: 'theme.preset=editorial-magazine with omitted structural variant',
		target: 'explicit editorial section variants',
		knownConsumers: ['legacy editorial-magazine payloads'],
		owner: 'variant-input-normalizer',
		retireWhen: 'all persisted editorial-magazine payloads carry explicit variants',
	},
	{
		legacy: 'visualProfileId intersection profile',
		target: 'composition.intersections',
		knownConsumers: ['persisted managed rows pending canonical promotion'],
		owner: 'variant-input-normalizer',
		retireWhen: 'all persisted managed rows carry explicit composition.intersections',
	},
] as const;

/** Identity compatibility is input-only; managed definitions author composition explicitly. */
const LEGACY_INTERSECTION_PROFILES: Readonly<Record<string, IntersectionProfile>> = {
	'abril-michelle-becerra-rea': {
		quote: { family: 'atmospheric-blend', source: 'hero' },
		'interlude-after-quote': { family: 'overlap', source: 'quote' },
		family: { family: 'atmospheric-blend', source: 'interlude-after-quote' },
		countdown: { family: 'atmospheric-blend', source: 'family' },
		location: { family: 'atmospheric-blend', source: 'countdown' },
		'interlude-after-location': { family: 'overlap', source: 'location' },
		itinerary: { family: 'atmospheric-blend', source: 'interlude-after-location' },
		rsvp: { family: 'arch', source: 'gallery' },
		thankYou: { family: 'atmospheric-blend', source: 'rsvp' },
	},
	'demo-xv-celestial-blue': {
		'interlude-after-family': { family: 'overlap', source: 'family' },
		gallery: { family: 'atmospheric-blend', source: 'interlude-after-family' },
		'interlude-after-location': { family: 'arch', source: 'location' },
		'interlude-after-itinerary': { family: 'overlap', source: 'itinerary' },
		'interlude-after-rsvp': { family: 'atmospheric-blend', source: 'rsvp' },
	},
	'alba-rosa-quinonez': {
		countdown: { family: 'atmospheric-blend', source: 'hero' },
		location: { family: 'atmospheric-blend', source: 'countdown' },
		'interlude-after-location': { family: 'arch', source: 'location' },
		gallery: { family: 'overlap', source: 'interlude-after-location' },
		gifts: { family: 'atmospheric-blend', source: 'gallery' },
		'personalized-access': { family: 'atmospheric-blend', source: 'gifts' },
		rsvp: { family: 'overlap', source: 'personalized-access' },
		family: { family: 'atmospheric-blend', source: 'rsvp' },
		thankYou: { family: 'atmospheric-blend', source: 'family' },
	},
	'daniela-y-martin': {
		quote: { family: 'atmospheric-blend', source: 'hero' },
		countdown: { family: 'atmospheric-blend', source: 'quote' },
		'interlude-after-countdown': { family: 'arch', source: 'countdown' },
		location: { family: 'atmospheric-blend', source: 'interlude-after-countdown' },
		'personalized-access': { family: 'overlap', source: 'location' },
		family: { family: 'atmospheric-blend', source: 'personalized-access' },
		gallery: { family: 'atmospheric-blend', source: 'family' },
		gifts: { family: 'atmospheric-blend', source: 'gallery' },
		'interlude-after-gifts': { family: 'atmospheric-blend', source: 'gifts' },
		rsvp: { family: 'atmospheric-blend', source: 'interlude-after-gifts' },
		thankYou: { family: 'atmospheric-blend', source: 'rsvp' },
	},
	'victoria-y-roberto': {
		quote: { family: 'atmospheric-blend', source: 'hero' },
		countdown: { family: 'atmospheric-blend', source: 'quote' },
		'interlude-after-countdown': { family: 'overlap', source: 'countdown' },
		location: { family: 'arch', source: 'interlude-after-countdown' },
		itinerary: { family: 'atmospheric-blend', source: 'location' },
		family: { family: 'atmospheric-blend', source: 'itinerary' },
		gallery: { family: 'atmospheric-blend', source: 'family' },
		gifts: { family: 'atmospheric-blend', source: 'gallery' },
		'interlude-after-gifts': { family: 'atmospheric-blend', source: 'gifts' },
		'personalized-access': { family: 'atmospheric-blend', source: 'interlude-after-gifts' },
		rsvp: { family: 'atmospheric-blend', source: 'personalized-access' },
		thankYou: { family: 'atmospheric-blend', source: 'rsvp' },
	},
};

const LEGACY_GALLERY_THEME_LAYOUTS: Readonly<Record<string, string>> = {
	editorial: 'editorial-mosaic',
	'editorial-rose': 'editorial-mosaic',
	'premiere-floral': 'editorial-mosaic',
	'editorial-magazine': 'magazine-spread',
	'luxury-hacienda': 'feature-mosaic',
	'celestial-blue': 'index-choreography',
};

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneRecord(value: unknown): JsonRecord | undefined {
	return isRecord(value) ? { ...value } : undefined;
}

function isOneOf(value: unknown, values: readonly string[]): value is string {
	return typeof value === 'string' && values.includes(value);
}

function resolveCanonicalOrLegacy(
	conflicts: VariantNormalizationConflict[],
	path: string[],
	canonical: unknown,
	legacy: unknown,
	fallback: string,
	areEquivalent: (left: unknown, right: unknown) => boolean = (left, right) => left === right,
): unknown {
	const hasCanonical = canonical !== undefined;
	const hasLegacy = legacy !== undefined;

	if (hasCanonical && hasLegacy) {
		if (areEquivalent(canonical, legacy)) return canonical;
		conflicts.push({
			path,
			canonical,
			legacy,
			message: `Conflicting variant inputs at ${path.join('.')}: canonical=${String(canonical)} legacy=${String(legacy)}`,
		});
		return canonical;
	}
	if (hasCanonical) return canonical;
	if (hasLegacy) return legacy;
	return fallback;
}

function gallerySemanticsEqual(left: unknown, right: unknown): boolean {
	const normalize = (value: unknown): unknown => (value === 'single' ? 'single-keepsake' : value);
	return normalize(left) === normalize(right);
}

function resolveGalleryLayout(value: unknown): string | undefined {
	if (value === 'single') return 'single-keepsake';
	if (isOneOf(value, GALLERY_LAYOUT_VARIANTS)) return value;
	if (isOneOf(value, THEME_PRESETS)) return LEGACY_GALLERY_THEME_LAYOUTS[value] ?? 'uniform-grid';
	return undefined;
}

function normalizeSectionStyles(input: JsonRecord): JsonRecord | undefined {
	const raw = cloneRecord(input.sectionStyles);
	if (!raw) return undefined;
	const result: JsonRecord = { ...raw };

	for (const key of ['gifts', 'rsvp', 'thankYou'] as const) {
		const section = cloneRecord(result[key]);
		if (!section) continue;
		delete section.structuralVariant;
		if (key === 'rsvp') delete section.labels;
		result[key] = section;
	}

	delete result.gallery;
	delete result.itinerary;

	const location = cloneRecord(result.location);
	if (location) {
		delete location.showFlourishes;
		delete location.showNavigationButtons;
		result.location = location;
	}

	return result;
}

function normalizeHero(
	result: JsonRecord,
	themePreset: string | undefined,
	conflicts: VariantNormalizationConflict[],
): void {
	const hero = cloneRecord(result.hero);
	if (!hero) return;
	const rawVariant = hero.variant;
	const canonical = isOneOf(rawVariant, HERO_STRUCTURAL_VARIANTS) ? rawVariant : undefined;
	const legacyVisual = isOneOf(rawVariant, THEME_PRESETS) ? rawVariant : undefined;
	const fallback = themePreset === 'editorial-magazine' ? 'editorial-cover' : 'standard';
	hero.variant = resolveCanonicalOrLegacy(
		conflicts,
		['hero', 'variant'],
		canonical ?? (legacyVisual ? undefined : rawVariant),
		hero.structuralVariant,
		fallback,
	);
	delete hero.structuralVariant;
	delete hero.visualVariant;
	result.hero = hero;
}

function normalizeFamily(result: JsonRecord, conflicts: VariantNormalizationConflict[]): void {
	const family = cloneRecord(result.family);
	if (!family) return;
	family.variant = resolveCanonicalOrLegacy(
		conflicts,
		['family', 'variant'],
		family.variant,
		family.structuralVariant,
		'standard',
	);
	delete family.structuralVariant;
	result.family = family;
}

function normalizeLocation(
	result: JsonRecord,
	sectionStyles: JsonRecord | undefined,
	conflicts: VariantNormalizationConflict[],
): void {
	const location = cloneRecord(result.location);
	if (!location) return;
	location.variant = resolveCanonicalOrLegacy(
		conflicts,
		['location', 'variant'],
		location.variant,
		location.structuralVariant,
		'standard',
	);
	delete location.structuralVariant;

	const legacyStyle = cloneRecord(sectionStyles?.location);
	const options = cloneRecord(location.presentationOptions) ?? {};
	if (options.showFlourishes === undefined && typeof legacyStyle?.showFlourishes === 'boolean') {
		options.showFlourishes = legacyStyle.showFlourishes;
	}
	if (
		options.showNavigationButtons === undefined &&
		typeof legacyStyle?.showNavigationButtons === 'boolean'
	) {
		options.showNavigationButtons = legacyStyle.showNavigationButtons;
	}
	if (Object.keys(options).length > 0) location.presentationOptions = options;
	result.location = location;
}

function normalizeGallery(
	result: JsonRecord,
	sectionStyles: JsonRecord | undefined,
	themePreset: string | undefined,
	conflicts: VariantNormalizationConflict[],
): void {
	const gallery = cloneRecord(result.gallery);
	if (!gallery) return;
	const legacyStyleVariant = cloneRecord(sectionStyles?.gallery)?.variant;
	const rawVariant = gallery.variant;
	const fromCanonical = resolveGalleryLayout(rawVariant);
	const fromLegacy = resolveGalleryLayout(legacyStyleVariant);
	const unknownCanonical =
		typeof rawVariant === 'string' &&
		rawVariant !== 'single' &&
		!isOneOf(rawVariant, GALLERY_LAYOUT_VARIANTS) &&
		!isOneOf(rawVariant, THEME_PRESETS);

	if (unknownCanonical) {
		if (fromLegacy !== undefined) {
			conflicts.push({
				path: ['gallery', 'variant'],
				canonical: rawVariant,
				legacy: legacyStyleVariant,
				message: `Conflicting variant inputs at gallery.variant: canonical=${String(rawVariant)} legacy=${String(legacyStyleVariant)}`,
			});
		}
		gallery.variant = rawVariant;
	} else if (fromCanonical !== undefined && fromLegacy !== undefined) {
		gallery.variant = resolveCanonicalOrLegacy(
			conflicts,
			['gallery', 'variant'],
			fromCanonical,
			fromLegacy,
			'uniform-grid',
			gallerySemanticsEqual,
		);
	} else if (fromCanonical !== undefined) {
		gallery.variant = fromCanonical;
	} else if (fromLegacy !== undefined) {
		gallery.variant = fromLegacy;
	} else if (rawVariant === undefined) {
		gallery.variant = LEGACY_GALLERY_THEME_LAYOUTS[themePreset ?? ''] ?? 'uniform-grid';
	}

	delete gallery.visualVariant;
	result.gallery = gallery;
}

function normalizeItinerary(
	result: JsonRecord,
	sectionStyles: JsonRecord | undefined,
	conflicts: VariantNormalizationConflict[],
): void {
	const itinerary = cloneRecord(result.itinerary);
	if (!itinerary) return;
	const presentation = cloneRecord(itinerary.presentation);
	const legacyStyleVariant = cloneRecord(sectionStyles?.itinerary)?.variant;
	const legacyFromPresentation = presentation?.behavior;
	const legacyFromStyles = isOneOf(legacyStyleVariant, ITINERARY_STRUCTURAL_VARIANTS)
		? legacyStyleVariant
		: undefined;
	const legacy = legacyFromPresentation !== undefined ? legacyFromPresentation : legacyFromStyles;

	itinerary.variant = resolveCanonicalOrLegacy(
		conflicts,
		['itinerary', 'variant'],
		itinerary.variant,
		legacy,
		'standard',
	);
	delete itinerary.presentation;
	result.itinerary = itinerary;
}

function normalizeGifts(
	result: JsonRecord,
	sectionStyles: JsonRecord | undefined,
	themePreset: string | undefined,
	conflicts: VariantNormalizationConflict[],
): void {
	const gifts = cloneRecord(result.gifts);
	if (!gifts) return;
	const legacy = cloneRecord(sectionStyles?.gifts)?.structuralVariant;
	const rawVariant = gifts.variant;
	const canonical = isOneOf(rawVariant, GIFTS_STRUCTURAL_VARIANTS) ? rawVariant : undefined;
	const legacyVisual = isOneOf(rawVariant, THEME_PRESETS) ? rawVariant : undefined;
	const fallback =
		legacyVisual === 'editorial-magazine' || themePreset === 'editorial-magazine'
			? 'editorial-catalog'
			: 'standard';
	gifts.variant = resolveCanonicalOrLegacy(
		conflicts,
		['gifts', 'variant'],
		canonical ?? (legacyVisual ? undefined : rawVariant),
		legacy,
		fallback,
	);
	delete gifts.structuralVariant;
	result.gifts = gifts;
}

function normalizeRsvp(
	result: JsonRecord,
	sectionStyles: JsonRecord | undefined,
	themePreset: string | undefined,
	conflicts: VariantNormalizationConflict[],
): void {
	const rsvp = cloneRecord(result.rsvp);
	if (!rsvp) return;
	const legacyStyle = cloneRecord(sectionStyles?.rsvp);
	const fallback = themePreset === 'editorial-magazine' ? 'editorial-press-pass' : 'standard';
	rsvp.variant = resolveCanonicalOrLegacy(
		conflicts,
		['rsvp', 'variant'],
		rsvp.variant,
		legacyStyle?.structuralVariant,
		fallback,
	);
	delete rsvp.structuralVariant;
	if (rsvp.labels === undefined && legacyStyle?.labels !== undefined)
		rsvp.labels = legacyStyle.labels;

	const personalizedAccess = cloneRecord(rsvp.personalizedAccess) ?? {};
	const accessFallback = themePreset === 'editorial-magazine' ? 'editorial-pass' : 'standard';
	personalizedAccess.variant = resolveCanonicalOrLegacy(
		conflicts,
		['rsvp', 'personalizedAccess', 'variant'],
		personalizedAccess.variant,
		personalizedAccess.structuralVariant,
		accessFallback,
	);
	delete personalizedAccess.structuralVariant;
	rsvp.personalizedAccess = personalizedAccess;
	result.rsvp = rsvp;
}

function normalizeThankYou(
	result: JsonRecord,
	sectionStyles: JsonRecord | undefined,
	themePreset: string | undefined,
	conflicts: VariantNormalizationConflict[],
): void {
	const thankYou = cloneRecord(result.thankYou);
	if (!thankYou) return;
	const legacy = cloneRecord(sectionStyles?.thankYou)?.structuralVariant;
	const fallback = themePreset === 'editorial-magazine' ? 'editorial-back-cover' : 'standard';
	thankYou.variant = resolveCanonicalOrLegacy(
		conflicts,
		['thankYou', 'variant'],
		thankYou.variant,
		legacy,
		fallback,
	);
	delete thankYou.structuralVariant;
	result.thankYou = thankYou;
}

function normalizeComposition(result: JsonRecord): void {
	if (isRecord(result.composition)) return;
	const profileId =
		typeof result.visualProfileId === 'string' ? result.visualProfileId : undefined;
	const intersections = profileId ? LEGACY_INTERSECTION_PROFILES[profileId] : undefined;
	if (intersections) result.composition = { intersections };
}

/**
 * Single compatibility boundary for structural variants and composition.
 * Unknown values are preserved deliberately so the canonical schema rejects them.
 * Conflicting canonical + legacy semantic inputs throw VariantNormalizationConflictError.
 */
export function normalizeInvitationVariantInput(input: unknown): unknown {
	if (!isRecord(input)) return input;
	const result: JsonRecord = { ...input };
	const sectionStyles = cloneRecord(input.sectionStyles);
	const themePreset = cloneRecord(input.theme)?.preset;
	const themeId = typeof themePreset === 'string' ? themePreset : undefined;
	const conflicts: VariantNormalizationConflict[] = [];

	normalizeHero(result, themeId, conflicts);
	normalizeFamily(result, conflicts);
	normalizeLocation(result, sectionStyles, conflicts);
	normalizeGallery(result, sectionStyles, themeId, conflicts);
	normalizeItinerary(result, sectionStyles, conflicts);
	normalizeGifts(result, sectionStyles, themeId, conflicts);
	normalizeRsvp(result, sectionStyles, themeId, conflicts);
	normalizeThankYou(result, sectionStyles, themeId, conflicts);
	normalizeComposition(result);

	const canonicalStyles = normalizeSectionStyles(result);
	if (canonicalStyles) result.sectionStyles = canonicalStyles;
	else delete result.sectionStyles;

	if (conflicts.length > 0) {
		throw new VariantNormalizationConflictError(conflicts);
	}
	return result;
}
