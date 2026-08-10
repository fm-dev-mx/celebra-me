export const XARENI_ASSET_SLUG = 'xv-xareni-iyarit';

export const XARENI_SEAL_COLORS = ['roseGold', 'champagne', 'blush', 'mauve', 'deepMauve'] as const;

export const FAMILY_PRESENTATIONS = ['with-photo', 'text-only'] as const;
export const LOCATION_PRESENTATIONS = ['simple', 'with-map', 'with-photo'] as const;
export const GALLERY_PRESENTATIONS = ['standard', 'pet-keepsake'] as const;
export const GALLERY_LAYOUT_ROLES = ['feature', 'wide', 'standard'] as const;
export const GALLERY_MOBILE_BROWSE_MODES = ['stack', 'rail'] as const;
export const GIFTS_PRESENTATIONS = ['catalog', 'legend-only'] as const;
export const COUNTDOWN_UNITS = ['days', 'hours', 'minutes', 'seconds'] as const;
export const ITINERARY_PRESENTATION_BEHAVIORS = ['standard', 'timeline-paper'] as const;

export type XareniSealColor = (typeof XARENI_SEAL_COLORS)[number];
export type FamilyPresentation = (typeof FAMILY_PRESENTATIONS)[number];
export type LocationPresentation = (typeof LOCATION_PRESENTATIONS)[number];
export type LocationMediaMode = 'none' | 'map' | 'image';
export type GalleryPresentation = (typeof GALLERY_PRESENTATIONS)[number];
export type GalleryLayoutRole = (typeof GALLERY_LAYOUT_ROLES)[number];
export type GalleryMobileBrowseMode = (typeof GALLERY_MOBILE_BROWSE_MODES)[number];
export type GiftsPresentation = (typeof GIFTS_PRESENTATIONS)[number];
export type CountdownUnit = (typeof COUNTDOWN_UNITS)[number];
export type ItineraryPresentationBehavior = (typeof ITINERARY_PRESENTATION_BEHAVIORS)[number];

export interface LocationPresentationOptions {
	showFlourishes?: boolean;
	/**
	 * When false and the venue has a map URL but no embeddable media
	 * (`mediaMode === 'none'`), VenueCard renders the linked map-preview
	 * surface instead of the Apple/Google/Waze navigation button row.
	 */
	showNavigationButtons?: boolean;
}

export interface HeroPresentationOptions {
	portraitEnabled?: boolean;
}

export interface ItineraryPresentationOptions {
	behavior?: ItineraryPresentationBehavior;
}

export interface CountdownPresentationOptions {
	/** Subset of countdown units to render. Absent/undefined → all four units. */
	visibleUnits?: CountdownUnit[];
}

export interface GalleryPresentationOptions {
	/**
	 * Mobile browse mode for layout variants that support it (e.g. magazine-spread).
	 * Default `stack` preserves the canonical column layout on small viewports.
	 */
	mobileBrowse?: GalleryMobileBrowseMode;
}

export const XARENI_SEAL_COLOR_LABELS: Record<XareniSealColor, string> = {
	roseGold: 'Oro rosado',
	champagne: 'Champagne',
	blush: 'Rosa blush',
	mauve: 'Malva',
	deepMauve: 'Malva profundo',
};

const XARENI_SEAL_COLOR_CSS: Record<XareniSealColor, string> = {
	roseGold: 'var(--xareni-rose-gold)',
	champagne: 'var(--xareni-champagne)',
	blush: 'var(--xareni-blush)',
	mauve: 'var(--xareni-mauve)',
	deepMauve: 'var(--xareni-deep-mauve)',
};

export function isXareniSealColor(value: unknown): value is XareniSealColor {
	return typeof value === 'string' && (XARENI_SEAL_COLORS as readonly string[]).includes(value);
}

export function resolveXareniSealColor(value: unknown): string | undefined {
	return isXareniSealColor(value) ? XARENI_SEAL_COLOR_CSS[value] : undefined;
}

export function supportsXareniPresentationOptions(context: { assetLookupSlug?: string }): boolean {
	return context.assetLookupSlug === XARENI_ASSET_SLUG;
}

export function shouldRenderFamilyMedia(
	presentation: FamilyPresentation | undefined,
	hasFeaturedImage: boolean,
): boolean {
	return presentation !== 'text-only' && hasFeaturedImage;
}

export function resolveLocationMediaMode(
	presentation: LocationPresentation | undefined,
	media: { hasCoordinates: boolean; hasImage: boolean },
): LocationMediaMode {
	if (presentation === 'simple') return 'none';
	if (presentation === 'with-map') {
		if (media.hasCoordinates) return 'map';
		return media.hasImage ? 'image' : 'none';
	}
	if (presentation === 'with-photo') {
		if (media.hasImage) return 'image';
		return media.hasCoordinates ? 'map' : 'none';
	}
	if (media.hasCoordinates) return 'map';
	return media.hasImage ? 'image' : 'none';
}

/**
 * Canonical owner of venue-card flourishes:
 *   `location.presentationOptions.showFlourishes`
 *
 * Legacy Published / demo data may still store the same flag under
 * `sectionStyles.location.showFlourishes`. Fold that legacy value only when the
 * canonical field is absent — never bidirectional sync.
 */
export function detectShowFlourishesConflict(input: {
	presentationOptions?: LocationPresentationOptions | null;
	legacySectionStylesShowFlourishes?: boolean;
}): boolean {
	const canonical = input.presentationOptions?.showFlourishes;
	const legacy = input.legacySectionStylesShowFlourishes;
	return canonical !== undefined && legacy !== undefined && canonical !== legacy;
}

/** Fold both legacy location flags into the canonical presentation options object. */
export function foldLocationPresentationOptions<T extends Record<string, unknown>>(
	location: T | undefined,
	legacySectionStylesShowFlourishes?: boolean,
	legacySectionStylesShowNavigationButtons?: boolean,
): T | undefined {
	if (!location) return location;
	const current = location.presentationOptions as LocationPresentationOptions | undefined;
	const showFlourishes = current?.showFlourishes ?? legacySectionStylesShowFlourishes;
	const showNavigationButtons =
		current?.showNavigationButtons ?? legacySectionStylesShowNavigationButtons;
	if (showFlourishes === undefined && showNavigationButtons === undefined) {
		return location;
	}
	return {
		...location,
		presentationOptions: {
			...(current ?? {}),
			...(showFlourishes !== undefined ? { showFlourishes } : {}),
			...(showNavigationButtons !== undefined ? { showNavigationButtons } : {}),
		},
	};
}

export function resolveLocationShowFlourishes(
	options: LocationPresentationOptions | undefined,
	legacySectionStylesShowFlourishes?: boolean,
): boolean {
	if (options?.showFlourishes !== undefined) return options.showFlourishes;
	if (legacySectionStylesShowFlourishes !== undefined) return legacySectionStylesShowFlourishes;
	return true;
}

export function resolveLocationShowNavigationButtons(
	options: LocationPresentationOptions | undefined,
	legacySectionStylesShowNavigationButtons?: boolean,
): boolean {
	return options?.showNavigationButtons ?? legacySectionStylesShowNavigationButtons ?? true;
}

export function resolvePortraitEnabled(
	options: HeroPresentationOptions | undefined,
	themeOffersPortrait: boolean,
): boolean {
	return options?.portraitEnabled ?? themeOffersPortrait;
}

export function resolveItineraryPresentation(
	options: ItineraryPresentationOptions | undefined,
): ItineraryPresentationBehavior {
	return options?.behavior ?? 'standard';
}

const COUNTDOWN_UNIT_SET = new Set<string>(COUNTDOWN_UNITS);

/**
 * Resolve countdown visible units. Absent options → all units.
 * Unknown units are dropped. An empty/invalid selection falls back to all units
 * so the section never renders with zero segments at runtime; schemas reject
 * empty arrays at the content boundary.
 */
export function resolveCountdownVisibleUnits(
	options: CountdownPresentationOptions | undefined,
): CountdownUnit[] {
	const requested = options?.visibleUnits;
	if (!requested || requested.length === 0) {
		return [...COUNTDOWN_UNITS];
	}
	const unique = [
		...new Set(requested.filter((unit): unit is CountdownUnit => COUNTDOWN_UNIT_SET.has(unit))),
	];
	return unique.length > 0 ? unique : [...COUNTDOWN_UNITS];
}

export function resolveGiftsPresentation(
	presentation: GiftsPresentation | undefined,
): GiftsPresentation {
	return presentation ?? 'catalog';
}

export function resolveGalleryMobileBrowse(
	options: GalleryPresentationOptions | undefined,
): GalleryMobileBrowseMode {
	return options?.mobileBrowse ?? 'stack';
}

export function assertSupportedGalleryPresentation(
	presentation: GalleryPresentation | undefined,
	items: ReadonlyArray<{ layoutRole?: GalleryLayoutRole }>,
): void {
	if (presentation === 'pet-keepsake' && items.some((item) => item.layoutRole !== undefined)) {
		throw new Error(
			'[Presentation] pet-keepsake gallery does not support per-item layout roles.',
		);
	}
}
