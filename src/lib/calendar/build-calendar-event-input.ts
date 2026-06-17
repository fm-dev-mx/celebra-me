import type { CalendarEventInput } from '@/lib/calendar/types';
import type { LocationSection } from '@/lib/adapters/types';

function getFirstVenueField(
	location: LocationSection,
	field: 'venueName' | 'address' | 'googleMapsUrl',
): string | undefined {
	const firstVenue = location.venues?.[0];
	return firstVenue?.[field] ?? location.ceremony?.[field] ?? location.reception?.[field];
}

function buildLocation(revealedLocation: LocationSection): CalendarEventInput['location'] {
	const venueName = getFirstVenueField(revealedLocation, 'venueName');
	const address = getFirstVenueField(revealedLocation, 'address');
	const mapsUrl = getFirstVenueField(revealedLocation, 'googleMapsUrl');

	if (!venueName && !address && !mapsUrl) return undefined;

	const loc: NonNullable<CalendarEventInput['location']> = {};
	if (venueName) loc.venueName = venueName;
	if (address) loc.address = address;
	if (mapsUrl) loc.mapsUrl = mapsUrl;
	return loc;
}

export function buildCalendarEventInput(input: {
	title: string;
	startsAt?: string;
	timezone?: string;
	revealedLocation?: LocationSection;
	fileName?: string;
}): CalendarEventInput | null {
	const { title, startsAt } = input;

	if (!startsAt) return null;

	const result: CalendarEventInput = { title, startsAt };

	if (input.timezone) result.timezone = input.timezone;
	if (input.fileName) result.fileName = input.fileName;
	if (input.revealedLocation) {
		const loc = buildLocation(input.revealedLocation);
		if (loc) result.location = loc;
	}

	return result;
}
