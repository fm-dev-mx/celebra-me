/**
 * Deterministic framing for the illustrated venue map.
 *
 * The venue preview is an in-house illustration, not a geographic basemap: it needs no tile
 * provider, credential or network request. Coordinates only vary its street angle and park side so
 * neighbouring venues on one invitation do not look identical. Navigation stays on the venue's
 * Google Maps, Apple Maps and Waze links.
 */
export interface VenueMapIllustration {
	/** Street grid rotation in degrees, within ±18. */
	rotation: number;
	/** Side of the pin where the park block sits. */
	parkSide: 'left' | 'right';
}

export function buildVenueMapIllustration(lat: number, lng: number): VenueMapIllustration {
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
		throw new Error('Venue map illustration requires finite coordinates.');
	}
	const seed = Math.abs(Math.round(lat * 10_000) * 31 + Math.round(lng * 10_000) * 17);
	return {
		rotation: (seed % 37) - 18,
		parkSide: seed % 2 === 0 ? 'left' : 'right',
	};
}
