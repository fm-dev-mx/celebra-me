import { generateIcsString } from '@/lib/calendar/ics';
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl } from '@/lib/calendar/provider-urls';
import type { CalendarEventInput } from '@/lib/calendar/types';
import { toCanonicalVenueDate, toCanonicalVenueTime } from '@/lib/invitation/venue-datetime';
import { deriveStartsAtUtc } from '@/lib/time/event-time';

export interface VenueCalendarLinks {
	googleUrl: string;
	outlookUrl: string;
	/** `data:` URL with the .ics file, so the download works without client JavaScript. */
	icsHref: string;
	icsFileName: string;
}

interface VenueCalendarSource {
	venueEvent: string;
	venueName: string;
	address?: string;
	date: string;
	time: string;
	googleMapsUrl?: string;
}

function toFileStem(value: string): string {
	const stem = value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return stem || 'evento';
}

/**
 * Calendar links for one venue, resolved from its local date/time in the event time zone.
 * Returns null when the venue has no parseable date/time or the time zone is unknown, so the
 * card never offers a calendar entry at a guessed instant.
 */
export function buildVenueCalendarLinks(
	venue: VenueCalendarSource,
	context: { eventTitle: string; timeZone?: string },
): VenueCalendarLinks | null {
	const date = toCanonicalVenueDate(venue.date);
	const time = toCanonicalVenueTime(venue.time);
	if (!date || !time || !context.timeZone) return null;

	const startsAt = deriveStartsAtUtc(`${date}T${time}`, context.timeZone);
	if (!startsAt) return null;

	const input: CalendarEventInput = {
		title: `${context.eventTitle} · ${venue.venueEvent}`,
		startsAt,
		timezone: context.timeZone,
		location: {
			venueName: venue.venueName,
			...(venue.address ? { address: venue.address } : {}),
			...(venue.googleMapsUrl ? { mapsUrl: venue.googleMapsUrl } : {}),
		},
	};
	const icsFileName = `${toFileStem(`${context.eventTitle}-${venue.venueEvent}`)}.ics`;

	return {
		googleUrl: buildGoogleCalendarUrl(input),
		outlookUrl: buildOutlookCalendarUrl(input),
		icsHref: `data:text/calendar;charset=utf-8,${encodeURIComponent(generateIcsString(input))}`,
		icsFileName,
	};
}
