/**
 * Strips superseded shapes from definition-built Published content.
 *
 * Definitions may still spell venue dates and times as Spanish prose
 * (`12 de septiembre de 2026`, `5:00 p. m.`). Renderers normalize both forms
 * before display, so converting them to the canonical `YYYY-MM-DD` / `HH:mm`
 * machine form here is display-neutral. `templateId` and `theme.fontFamily`
 * are read by no renderer and are no longer published.
 */
import {
	isLegacyVenueDateProse,
	isLegacyVenueTimeProse,
	toCanonicalVenueDate,
	toCanonicalVenueTime,
} from '../../../src/lib/invitation/venue-datetime.ts';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalizeTime(record: JsonRecord): JsonRecord {
	if (!isLegacyVenueTimeProse(record.time)) return record;
	return { ...record, time: toCanonicalVenueTime(record.time) };
}

function canonicalizeVenue(venue: unknown): unknown {
	if (!isRecord(venue)) return venue;
	const timed = canonicalizeTime(venue);
	if (!isLegacyVenueDateProse(timed.date)) return timed;
	return { ...timed, date: toCanonicalVenueDate(timed.date) };
}

export function stripSupersededPublishedShapes(content: JsonRecord): JsonRecord {
	const { templateId: _templateId, ...result } = content;

	if (isRecord(result.theme) && 'fontFamily' in result.theme) {
		const { fontFamily: _fontFamily, ...theme } = result.theme;
		result.theme = theme;
	}

	if (isRecord(result.location)) {
		const location = { ...result.location };
		if (Array.isArray(location.venues))
			location.venues = location.venues.map(canonicalizeVenue);
		if (isRecord(location.ceremony)) location.ceremony = canonicalizeVenue(location.ceremony);
		if (isRecord(location.reception))
			location.reception = canonicalizeVenue(location.reception);
		result.location = location;
	}

	if (isRecord(result.itinerary) && Array.isArray(result.itinerary.items)) {
		result.itinerary = {
			...result.itinerary,
			items: result.itinerary.items.map((item) =>
				isRecord(item) ? canonicalizeTime(item) : item,
			),
		};
	}

	return result;
}
