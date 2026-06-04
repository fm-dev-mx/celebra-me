export interface FieldFallbackSpec {
	section: string;
	field: string;
}

export function applyFieldFallbacks(
	result: Record<string, unknown>,
	publishedFlat: Record<string, unknown>,
	demoFlat: Record<string, unknown>,
	fallbacks: FieldFallbackSpec[],
): void {
	for (const { section, field } of fallbacks) {
		const resultSection = result[section] as Record<string, unknown> | undefined;
		if (!resultSection || resultSection[field] !== undefined) continue;

		const publishedSection = publishedFlat[section] as Record<string, unknown> | undefined;
		const demoSection = demoFlat[section] as Record<string, unknown> | undefined;

		const fallback = publishedSection?.[field] ?? demoSection?.[field];
		if (fallback !== undefined) {
			resultSection[field] = structuredClone(fallback);
		}
	}
}

export function applyVenueImageFallbacks(
	result: Record<string, unknown>,
	publishedFlat: Record<string, unknown>,
	demoFlat: Record<string, unknown>,
	venueKeys: readonly string[],
): void {
	const locationSection = result.location as Record<string, unknown> | undefined;
	if (!locationSection) return;

	for (const venueKey of venueKeys) {
		const venue = locationSection[venueKey] as Record<string, unknown> | undefined;
		if (!venue || venue.image !== undefined) continue;

		const publishedLocation = publishedFlat.location as Record<string, unknown> | undefined;
		const demoLocation = demoFlat.location as Record<string, unknown> | undefined;

		const fallback =
			(publishedLocation?.[venueKey] as Record<string, unknown> | undefined)?.image ??
			(demoLocation?.[venueKey] as Record<string, unknown> | undefined)?.image;
		if (fallback !== undefined) {
			venue.image = structuredClone(fallback);
		}
	}
}
