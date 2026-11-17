/**
 * Host-set RSVP deadline: a calendar date (YYYY-MM-DD) in the event's time zone.
 * Guests may reply through the end of that day; from the next day RSVP is closed.
 * Pure helpers shared by the host endpoint, the RSVP submission guard and the
 * public invitation, so client and server evaluate the same rule.
 */

import { isValidIanaTimeZone } from '@/lib/time/event-time';

const DEFAULT_TIME_ZONE = 'America/Chihuahua';
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS_ES = [
	'enero',
	'febrero',
	'marzo',
	'abril',
	'mayo',
	'junio',
	'julio',
	'agosto',
	'septiembre',
	'octubre',
	'noviembre',
	'diciembre',
] as const;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const match = ISO_DATE.exec(value);
	if (!match) return false;
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

function safeZone(timeZone: string | null | undefined): string {
	return timeZone && isValidIanaTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

/** Today's calendar date (YYYY-MM-DD) in the given time zone. */
export function todayInZone(now: Date, timeZone: string | null | undefined): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: safeZone(timeZone),
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(now);
	const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
	return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * True once the deadline day has ended in the event's time zone. No deadline
 * (or an unreadable one) never closes RSVP.
 */
export function isRsvpClosed(
	deadline: string | null | undefined,
	timeZone: string | null | undefined,
	now = new Date(),
): boolean {
	if (!isIsoDate(deadline)) return false;
	return todayInZone(now, timeZone) > deadline;
}

export type RsvpDeadlineValidation =
	| { ok: true; deadline: string | null; past: boolean }
	| { ok: false; reason: 'format' | 'after_event' };

/**
 * Validates a host-entered deadline. `null` clears it. A date after the event is
 * rejected; a date already over is accepted with `past: true` so callers can ask
 * the host to confirm that replies will close.
 */
export function validateRsvpDeadline(input: {
	deadline: unknown;
	eventDate: string | null | undefined;
	timeZone: string | null | undefined;
	now?: Date;
}): RsvpDeadlineValidation {
	if (input.deadline === null || input.deadline === '') {
		return { ok: true, deadline: null, past: false };
	}
	if (!isIsoDate(input.deadline)) return { ok: false, reason: 'format' };
	if (isIsoDate(input.eventDate) && input.deadline > input.eventDate) {
		return { ok: false, reason: 'after_event' };
	}
	return {
		ok: true,
		deadline: input.deadline,
		past: isRsvpClosed(input.deadline, input.timeZone, input.now ?? new Date()),
	};
}

/** "20 de noviembre de 2026" for a YYYY-MM-DD date; empty for anything else. */
export function formatRsvpDeadlineEs(deadline: string | null | undefined): string {
	if (!isIsoDate(deadline)) return '';
	const [year, month, day] = deadline.split('-').map(Number);
	return `${day} de ${MONTHS_ES[month - 1]} de ${year}`;
}

/** Spanish ("usted") messages for each validation failure. */
export const RSVP_DEADLINE_MESSAGES = {
	format: 'Escriba una fecha válida.',
	after_event: 'La fecha límite no puede ser posterior a la fecha del evento.',
	past: 'Esa fecha ya pasó. Si la guarda, sus invitados ya no podrán confirmar asistencia.',
	closed: 'El plazo para confirmar asistencia terminó. Comuníquese con el anfitrión.',
} as const;
