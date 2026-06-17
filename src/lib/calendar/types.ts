export interface CalendarEventInput {
	title: string;
	description?: string;
	/** ISO 8601 UTC string — e.g. "2026-12-12T18:00:00.000Z" */
	startsAt: string;
	/** Optional ISO 8601 UTC string. If absent, DTEND is omitted from .ics. */
	endsAt?: string;
	/** IANA timezone ID — e.g. "America/Mexico_City". Used for VTIMEZONE. */
	timezone?: string;
	location?: {
		venueName?: string;
		address?: string;
		mapsUrl?: string;
	};
	/** File name for the .ics download, without extension */
	fileName?: string;
}
