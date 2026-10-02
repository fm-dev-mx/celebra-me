/**
 * Form-side reading of a space's schedule: the same rules the server enforces,
 * surfaced next to the field before the request is sent. The inputs are wall-clock
 * values in the event time zone, so they are compared as naive instants; the
 * server stays the authority on the real ones.
 */

import { MEMORIES_OBJECT_MAX_LIFETIME_DAYS } from '@/lib/memories/contract/limits';

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type MemoriesScheduleIssue =
	'missing' | 'ends_before_start' | 'retention_before_end' | 'retention_too_long';

export interface MemoriesScheduleCheck {
	startsIssue: MemoriesScheduleIssue | null;
	endsIssue: MemoriesScheduleIssue | null;
	retentionIssue: MemoriesScheduleIssue | null;
	valid: boolean;
	/** Whole days between opening and the end of retention. */
	retentionDays: number | null;
	/** Whole days the window opens before, and closes after, the event date. */
	daysBeforeEvent: number | null;
	daysAfterEvent: number | null;
}

function parseLocal(value: string): number | null {
	if (!LOCAL_DATE_TIME.test(value)) return null;
	const instant = Date.parse(`${value}:00Z`);
	return Number.isNaN(instant) ? null : instant;
}

function parseEventDate(eventDate: string | null): number | null {
	if (!eventDate || !LOCAL_DATE.test(eventDate)) return null;
	const instant = Date.parse(`${eventDate}T00:00:00Z`);
	return Number.isNaN(instant) ? null : instant;
}

function resolveEndsIssue(
	starts: number | null,
	ends: number | null,
): MemoriesScheduleIssue | null {
	if (ends === null) return 'missing';
	return starts !== null && ends <= starts ? 'ends_before_start' : null;
}

function resolveRetentionIssue(
	starts: number | null,
	ends: number | null,
	retention: number | null,
): MemoriesScheduleIssue | null {
	if (retention === null) return 'missing';
	if (ends !== null && retention < ends) return 'retention_before_end';
	const tooLong =
		starts !== null && retention - starts > MEMORIES_OBJECT_MAX_LIFETIME_DAYS * DAY_MS;
	return tooLong ? 'retention_too_long' : null;
}

/** Whole days from `from` to `to`; null when either side is unknown. */
function daysBetween(from: number | null, to: number | null, round = Math.round): number | null {
	return from === null || to === null ? null : round((to - from) / DAY_MS);
}

export function checkMemoriesSchedule(input: {
	uploadStartsLocal: string;
	uploadEndsLocal: string;
	retentionEndsLocal: string;
	eventDate: string | null;
}): MemoriesScheduleCheck {
	const starts = parseLocal(input.uploadStartsLocal);
	const ends = parseLocal(input.uploadEndsLocal);
	const retention = parseLocal(input.retentionEndsLocal);
	const event = parseEventDate(input.eventDate);

	const startsIssue: MemoriesScheduleIssue | null = starts === null ? 'missing' : null;
	const endsIssue = resolveEndsIssue(starts, ends);
	const retentionIssue = resolveRetentionIssue(starts, ends, retention);
	const retentionDays = daysBetween(starts, retention, Math.floor);

	return {
		startsIssue,
		endsIssue,
		retentionIssue,
		valid: !startsIssue && !endsIssue && !retentionIssue,
		retentionDays: retentionDays !== null && retentionDays >= 0 ? retentionDays : null,
		daysBeforeEvent: daysBetween(starts, event),
		daysAfterEvent: daysBetween(event, ends),
	};
}
