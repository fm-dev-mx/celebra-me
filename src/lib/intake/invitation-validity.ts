import { isValidIanaTimeZone, isValidUtcIso, parseEventLocalDateTime } from '@/lib/time/event-time';

export type InvitationValidity = 'upcoming' | 'past' | 'unknown' | 'not_applicable';

export interface InvitationSchedule {
	eventDate: string | null;
	eventTimeZone: string;
	validity: InvitationValidity;
}

export interface InvitationTimingProjection {
	eventTiming?: unknown;
	heroDate?: unknown;
}

const DEFAULT_TIME_ZONE = 'America/Chihuahua';

function dateInZone(now: Date, timeZone: string): string {
	const safeZone = isValidIanaTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: safeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(now);
	const part = (type: string) => parts.find((item) => item.type === type)?.value;
	return `${part('year')}-${part('month')}-${part('day')}`;
}

export function classifyInvitationDate(
	kind: 'client' | 'demo',
	eventDate: string | null,
	timeZone: string,
	now = new Date(),
): InvitationValidity {
	if (kind === 'demo') return 'not_applicable';
	if (!eventDate) return 'unknown';
	const today = dateInZone(now, timeZone);
	return eventDate >= today ? 'upcoming' : 'past';
}

function parseLegacyDate(value: unknown): string | null {
	// Legacy hero dates are floating local dates, even when suffixed with Z.
	if (
		typeof value !== 'string' ||
		!/^\d{4}-\d{2}-\d{2}(?:$|T\d{2}:\d{2}(?::[0-5]\d(?:\.\d+)?)?Z?$)/.test(value)
	)
		return null;
	return (
		parseEventLocalDateTime(value.length === 10 ? `${value}T00:00` : value.slice(0, 16))?.slice(
			0,
			10,
		) ?? null
	);
}

export function resolveInvitationSchedule(
	kind: 'client' | 'demo',
	content?: InvitationTimingProjection,
	now = new Date(),
): InvitationSchedule {
	const timing =
		content?.eventTiming && typeof content.eventTiming === 'object'
			? (content.eventTiming as Record<string, unknown>)
			: {};
	const zone = timing.timeZone;
	const eventTimeZone = isValidIanaTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
	let eventDate: string | null;
	// A malformed explicit timing must not be masked by legacy data.
	if (timing.localDateTime != null) {
		eventDate = parseEventLocalDateTime(timing.localDateTime)?.slice(0, 10) ?? null;
	} else if (timing.startsAtUtc != null) {
		eventDate = isValidUtcIso(timing.startsAtUtc)
			? dateInZone(new Date(timing.startsAtUtc), eventTimeZone)
			: null;
	} else {
		eventDate = parseLegacyDate(content?.heroDate);
	}
	if (zone != null && zone !== '' && !isValidIanaTimeZone(zone)) eventDate = null;
	if (kind === 'demo') eventDate = null;
	return {
		eventDate,
		eventTimeZone,
		validity: classifyInvitationDate(kind, eventDate, eventTimeZone, now),
	};
}
