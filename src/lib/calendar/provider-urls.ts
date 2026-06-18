import type { CalendarEventInput } from '@/lib/calendar/types';

export const DEFAULT_PROVIDER_EVENT_DURATION_HOURS = 2;

const GOOGLE_CALENDAR_BASE_URL = 'https://calendar.google.com/calendar/render';
const OUTLOOK_CALENDAR_BASE_URL = 'https://outlook.office.com/calendar/deeplink/compose';

function toValidDate(value: string): Date {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid calendar date: ${value}`);
	}
	return date;
}

function resolveProviderEndDate(input: CalendarEventInput): Date {
	if (input.endsAt) return toValidDate(input.endsAt);

	const startsAt = toValidDate(input.startsAt);
	return new Date(startsAt.getTime() + DEFAULT_PROVIDER_EVENT_DURATION_HOURS * 60 * 60 * 1000);
}

function stripMsFromIso(date: Date): string {
	return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function formatGoogleUtcDate(date: Date): string {
	return stripMsFromIso(date).replace(/[-:]/g, '');
}

function formatOutlookUtcDate(date: Date): string {
	return stripMsFromIso(date);
}

function buildCalendarLocationText(location: CalendarEventInput['location']): string | undefined {
	if (!location) return undefined;

	const parts = [location.venueName, location.address, location.mapsUrl].filter(
		(part): part is string => Boolean(part),
	);

	return parts.length > 0 ? parts.join(', ') : undefined;
}

export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
	const startsAt = toValidDate(input.startsAt);
	const endsAt = resolveProviderEndDate(input);
	const location = buildCalendarLocationText(input.location);
	const params = new URLSearchParams({
		action: 'TEMPLATE',
		text: input.title,
		dates: `${formatGoogleUtcDate(startsAt)}/${formatGoogleUtcDate(endsAt)}`,
	});

	if (input.description) params.set('details', input.description);
	if (location) params.set('location', location);

	return `${GOOGLE_CALENDAR_BASE_URL}?${params.toString()}`;
}

export function buildOutlookCalendarUrl(input: CalendarEventInput): string {
	const startsAt = toValidDate(input.startsAt);
	const endsAt = resolveProviderEndDate(input);
	const location = buildCalendarLocationText(input.location);
	const params = new URLSearchParams({
		path: '/calendar/action/compose',
		rru: 'addevent',
		startdt: formatOutlookUtcDate(startsAt),
		enddt: formatOutlookUtcDate(endsAt),
		subject: input.title,
	});

	if (input.description) params.set('body', input.description);
	if (location) params.set('location', location);

	return `${OUTLOOK_CALENDAR_BASE_URL}?${params.toString()}`;
}
