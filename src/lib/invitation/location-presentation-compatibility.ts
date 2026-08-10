import {
	resolveLocationShowFlourishes as resolveCanonicalLocationShowFlourishes,
	resolveLocationShowNavigationButtons as resolveCanonicalLocationShowNavigationButtons,
	type LocationPresentationOptions,
} from './location-presentation';

export type { LocationPresentationOptions } from './location-presentation';

/**
 * Reports a conflict between the canonical Location option and its historical
 * sectionStyles mirror without mutating either value.
 */
export function detectShowFlourishesConflict(input: {
	presentationOptions?: LocationPresentationOptions | null;
	legacySectionStylesShowFlourishes?: boolean;
}): boolean {
	const canonical = input.presentationOptions?.showFlourishes;
	const legacy = input.legacySectionStylesShowFlourishes;
	return canonical !== undefined && legacy !== undefined && canonical !== legacy;
}

/** Fold historical Location flags into canonical presentationOptions once. */
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

/** Compatibility wrapper retaining the historical resolver signature. */
export function resolveLocationShowFlourishes(
	options: LocationPresentationOptions | undefined,
	legacySectionStylesShowFlourishes?: boolean,
): boolean {
	return (
		options?.showFlourishes ??
		legacySectionStylesShowFlourishes ??
		resolveCanonicalLocationShowFlourishes(options)
	);
}

/** Compatibility wrapper retaining the historical resolver signature. */
export function resolveLocationShowNavigationButtons(
	options: LocationPresentationOptions | undefined,
	legacySectionStylesShowNavigationButtons?: boolean,
): boolean {
	return (
		options?.showNavigationButtons ??
		legacySectionStylesShowNavigationButtons ??
		resolveCanonicalLocationShowNavigationButtons(options)
	);
}
