export const ITINERARY_PRESENTATION_BEHAVIORS = ['standard', 'timeline-paper'] as const;

export type ItineraryPresentationBehavior = (typeof ITINERARY_PRESENTATION_BEHAVIORS)[number];

export interface ItineraryPresentationOptions {
	behavior?: ItineraryPresentationBehavior;
}

export function resolveItineraryPresentation(
	options: ItineraryPresentationOptions | undefined,
): ItineraryPresentationBehavior {
	return options?.behavior ?? 'standard';
}
