import { ITINERARY_VARIANTS } from './section-variants';

/** @deprecated Prefer ITINERARY_VARIANTS — kept as the presentation-options export surface. */
export const ITINERARY_PRESENTATION_BEHAVIORS = ITINERARY_VARIANTS;

export type ItineraryPresentationBehavior = (typeof ITINERARY_VARIANTS)[number];

export interface ItineraryPresentationOptions {
	behavior?: ItineraryPresentationBehavior;
}

export function resolveItineraryPresentation(
	options: ItineraryPresentationOptions | undefined,
): ItineraryPresentationBehavior {
	return options?.behavior ?? 'standard';
}
