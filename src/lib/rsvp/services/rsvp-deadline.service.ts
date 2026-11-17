import type { EventRecord } from '@/interfaces/rsvp/domain.interface';
import { ApiError } from '@/lib/rsvp/core/errors';
import {
	findEventByIdService,
	findEventBySlugService,
	updateEventService,
} from '@/lib/rsvp/repositories/event.repository';
import { getSharingConfigForSlug } from '@/lib/rsvp/services/shared/invitation-helpers';
import {
	formatRsvpDeadlineEs,
	isRsvpClosed,
	RSVP_DEADLINE_MESSAGES,
	validateRsvpDeadline,
} from '@/lib/rsvp/rsvp-deadline';

type DeadlineEvent = Pick<EventRecord, 'id' | 'slug' | 'eventType' | 'rsvpDeadline'>;

export interface RsvpWindow {
	/** YYYY-MM-DD, event time zone, inclusive; null = no host deadline. */
	deadline: string | null;
	/** "20 de noviembre de 2026"; empty without a deadline. */
	label: string;
	closed: boolean;
	eventDate: string | null;
	eventTimeZone: string;
}

/** Event date and time zone from the invitation content linked to the event. */
async function resolveEventSchedule(
	event: Pick<EventRecord, 'slug' | 'eventType'>,
): Promise<{ eventDate: string | null; eventTimeZone: string }> {
	const config = await getSharingConfigForSlug(event.slug, event.eventType);
	return {
		eventDate: config.eventDate ?? null,
		eventTimeZone: config.eventTimeZone ?? 'America/Chihuahua',
	};
}

async function resolveRsvpWindow(event: DeadlineEvent, now = new Date()): Promise<RsvpWindow> {
	const schedule = await resolveEventSchedule(event);
	const deadline = event.rsvpDeadline ?? null;
	return {
		deadline,
		label: formatRsvpDeadlineEs(deadline),
		closed: isRsvpClosed(deadline, schedule.eventTimeZone, now),
		...schedule,
	};
}

/**
 * Deadline shown on the public invitation. Null when the event has no host
 * deadline, so invitations without one keep their markup and skip extra reads.
 */
export async function loadPublicRsvpWindow(
	slug: string,
	now = new Date(),
): Promise<{ label: string; closed: boolean } | null> {
	const event = await findEventBySlugService(slug);
	if (!event?.rsvpDeadline) return null;
	const window = await resolveRsvpWindow(event, now);
	return { label: window.label, closed: window.closed };
}

function rsvpClosedError(): ApiError {
	return new ApiError(403, 'rsvp_closed', RSVP_DEADLINE_MESSAGES.closed);
}

/**
 * Throws `rsvp_closed` when the host deadline has passed. Events without a
 * deadline skip the content read entirely.
 */
export async function assertRsvpOpen(
	eventOrId: DeadlineEvent | string,
	now = new Date(),
): Promise<void> {
	const event = typeof eventOrId === 'string' ? await findEventByIdService(eventOrId) : eventOrId;
	if (!event?.rsvpDeadline) return;
	const { eventTimeZone } = await resolveEventSchedule(event);
	if (isRsvpClosed(event.rsvpDeadline, eventTimeZone, now)) throw rsvpClosedError();
}

/**
 * Host update of the RSVP deadline. Rejects a date after the event; a date that
 * is already over needs `confirmPast` (it closes replies at once).
 */
export async function updateRsvpDeadline(input: {
	event: DeadlineEvent;
	deadline: unknown;
	confirmPast: boolean;
	now?: Date;
}): Promise<RsvpWindow> {
	const now = input.now ?? new Date();
	const schedule = await resolveEventSchedule(input.event);
	const result = validateRsvpDeadline({
		deadline: input.deadline,
		eventDate: schedule.eventDate,
		timeZone: schedule.eventTimeZone,
		now,
	});
	if (!result.ok) {
		throw new ApiError(400, 'bad_request', RSVP_DEADLINE_MESSAGES[result.reason]);
	}
	if (result.past && !input.confirmPast) {
		throw new ApiError(409, 'deadline_in_past', RSVP_DEADLINE_MESSAGES.past);
	}
	const updated = await updateEventService({
		eventId: input.event.id,
		rsvpDeadline: result.deadline,
	});
	const deadline = updated.rsvpDeadline ?? null;
	return {
		deadline,
		label: formatRsvpDeadlineEs(deadline),
		closed: isRsvpClosed(deadline, schedule.eventTimeZone, now),
		...schedule,
	};
}
