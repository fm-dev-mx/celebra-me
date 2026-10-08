export const LOCATION_PRESENTATIONS = ['simple', 'with-map', 'with-photo'] as const;

export type LocationPresentation = (typeof LOCATION_PRESENTATIONS)[number];
export type LocationMediaMode = 'none' | 'map' | 'image';

export const LOCATION_MAP_STYLES = ['dark', 'colorful', 'minimal', 'satellite', 'rustic'] as const;

export type LocationMapStyle = (typeof LOCATION_MAP_STYLES)[number];

export const LOCATION_REVEAL_SURFACES = ['section', 'rsvp'] as const;

export type LocationRevealSurface = (typeof LOCATION_REVEAL_SURFACES)[number];

/**
 * How the indications list is laid out:
 * - `list` (default): icon + copy rows styled by the theme tokens.
 * - `numbered-board`: each indication becomes a board with a large ordinal, the icon and the copy.
 */
export const LOCATION_INDICATIONS_STYLES = ['list', 'numbered-board'] as const;

export type LocationIndicationsStyle = (typeof LOCATION_INDICATIONS_STYLES)[number];

export interface LocationPresentationOptions {
	showFlourishes?: boolean;
	/**
	 * When false and the venue has a map URL but no embeddable media
	 * (`mediaMode === 'none'`), VenueCard renders the linked map-preview
	 * surface instead of the Apple/Google/Waze navigation button row.
	 */
	showNavigationButtons?: boolean;
	/**
	 * Where after-rsvp location details surface:
	 * - `section` (default): keep Location in the public plan as a locked section
	 * - `rsvp`: omit Location from the public plan and reveal via RSVP when confirmed
	 */
	revealSurface?: LocationRevealSurface;
	/**
	 * `list` (default) keeps indications as numbered notes; `band` presents them as their own
	 * titled band: the first indication featured, the rest as notes under a separator.
	 */
	indicationsLayout?: LocationIndicationsLayout;
	/** Indications layout; `list` when omitted. */
	indicationsStyle?: LocationIndicationsStyle;
	/** Adds a no-JS "Agendar en el calendario" disclosure to each venue with a date and time. */
	showCalendarLinks?: boolean;
}

export const LOCATION_INDICATIONS_LAYOUTS = ['list', 'band', 'enclosure'] as const;
export type LocationIndicationsLayout = (typeof LOCATION_INDICATIONS_LAYOUTS)[number];

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

/** Renderer-facing canonical default for venue-card flourishes. */
export function resolveLocationShowFlourishes(
	options: LocationPresentationOptions | undefined,
	variant?: string,
): boolean {
	if (options?.showFlourishes !== undefined) return options.showFlourishes;
	return variant !== 'split-map';
}

/** Renderer-facing canonical default for venue navigation buttons. */
export function resolveLocationShowNavigationButtons(
	options: LocationPresentationOptions | undefined,
): boolean {
	return options?.showNavigationButtons ?? true;
}

/** Renderer-facing canonical default for the indications layout. */
export function resolveLocationIndicationsStyle(
	options: LocationPresentationOptions | undefined,
): LocationIndicationsStyle {
	return options?.indicationsStyle ?? 'list';
}
