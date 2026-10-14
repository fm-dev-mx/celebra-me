/**
 * Public validity window of a client invitation: it stays online until the end of the
 * anniversary of its own event date (event date + 1 year, 23:59:59.999 in the event time
 * zone; Feb 29 → Feb 28). Afterwards guests get exactly what a disabled invitation gets.
 * Demos never expire, and an invitation without a resolvable event date never expires.
 *
 * Dependency-free on purpose: imported by server code, client islands and release scripts.
 */

export interface InvitationValidityWindow {
	/** Last public instant is `expiresAt`; null when the invitation never expires. */
	expiresAt: Date | null;
	expired: boolean;
}

const NEVER_EXPIRES: InvitationValidityWindow = Object.freeze({ expiresAt: null, expired: false });
const EVENT_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseEventDate(value: string): { year: number; month: number; day: number } | null {
	const match = EVENT_DATE_RE.exec(value);
	if (!match) return null;
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const probe = new Date(Date.UTC(year, month - 1, day));
	if (
		probe.getUTCFullYear() !== year ||
		probe.getUTCMonth() !== month - 1 ||
		probe.getUTCDate() !== day
	) {
		return null;
	}
	return { year, month, day };
}

/** Offset (ms) of `timeZone` from UTC at `instant`; throws RangeError for unknown zones. */
function zoneOffsetMs(instant: number, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	}).formatToParts(new Date(instant));
	const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
	const asUtc = Date.UTC(
		read('year'),
		read('month') - 1,
		read('day'),
		read('hour'),
		read('minute'),
		read('second'),
	);
	return asUtc - Math.floor(instant / 1000) * 1000;
}

/** UTC instant of a local wall-clock midnight in `timeZone`. */
function zonedMidnightToUtc(year: number, month: number, day: number, timeZone: string): number {
	const wall = Date.UTC(year, month - 1, day);
	const first = wall - zoneOffsetMs(wall, timeZone);
	const second = wall - zoneOffsetMs(first, timeZone);
	return second;
}

/** Last public instant for an event date, or null when the date or zone is unusable. */
export function resolveInvitationExpiresAt(
	eventDate: string | null | undefined,
	timeZone: string,
): Date | null {
	if (typeof eventDate !== 'string') return null;
	const parsed = parseEventDate(eventDate.trim());
	if (!parsed) return null;
	const year = parsed.year + 1;
	// Feb 29 has no anniversary in the next (never leap) year: the window closes on Feb 28.
	const day = parsed.month === 2 && parsed.day === 29 ? 28 : parsed.day;
	const nextDay = new Date(Date.UTC(year, parsed.month - 1, day + 1));
	try {
		const nextMidnight = zonedMidnightToUtc(
			nextDay.getUTCFullYear(),
			nextDay.getUTCMonth() + 1,
			nextDay.getUTCDate(),
			timeZone,
		);
		return Number.isFinite(nextMidnight) ? new Date(nextMidnight - 1) : null;
	} catch {
		return null;
	}
}

export function resolveInvitationValidityWindow(
	eventDate: string | null | undefined,
	timeZone: string,
	now: Date,
	options: { isDemo?: boolean } = {},
): InvitationValidityWindow {
	if (options.isDemo) return NEVER_EXPIRES;
	const expiresAt = resolveInvitationExpiresAt(eventDate, timeZone);
	if (!expiresAt) return NEVER_EXPIRES;
	return { expiresAt, expired: now.getTime() > expiresAt.getTime() };
}
