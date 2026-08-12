import { ITINERARY_STRUCTURAL_VARIANTS } from './structural-variants';

/** @deprecated Prefer ITINERARY_STRUCTURAL_VARIANTS — kept as the presentation-options export surface. */
export const ITINERARY_PRESENTATION_BEHAVIORS = ITINERARY_STRUCTURAL_VARIANTS;

export type ItineraryPresentationBehavior = (typeof ITINERARY_PRESENTATION_BEHAVIORS)[number];

export interface ItineraryPresentationOptions {
	behavior?: ItineraryPresentationBehavior;
}

export function resolveItineraryPresentation(
	options: ItineraryPresentationOptions | undefined,
): ItineraryPresentationBehavior {
	return options?.behavior ?? 'standard';
}
