export const LOCATION_PRESENTATIONS = ['simple', 'with-map', 'with-photo'] as const;

export type LocationPresentation = (typeof LOCATION_PRESENTATIONS)[number];
export type LocationMediaMode = 'none' | 'map' | 'image';

export const LOCATION_REVEAL_SURFACES = ['section', 'rsvp'] as const;

export type LocationRevealSurface = (typeof LOCATION_REVEAL_SURFACES)[number];

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
