import { fromZonedTime } from 'date-fns-tz';

export interface EventTiming {
	localDateTime?: string;
	timeZone?: string;
	startsAtUtc?: string;
}

export type CountdownTargetSource = 'eventTiming' | 'legacyHeroDate';

export interface CountdownTarget {
	targetIso: string;
	source: CountdownTargetSource;
}

const EVENT_LOCAL_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function parseEventLocalDateTime(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	if (!EVENT_LOCAL_DATETIME_PATTERN.test(trimmed)) return null;

	const [datePart, timePart] = trimmed.split('T');
	const [year, month, day] = datePart.split('-').map(Number);
	const [hours, minutes] = timePart.split(':').map(Number);

	if (month < 1 || month > 12) return null;
	if (day < 1 || day > 31) return null;
	if (hours < 0 || hours > 23) return null;
	if (minutes < 0 || minutes > 59) return null;

	// Reject impossible dates like Feb 30, Apr 31, Feb 29 in non-leap years
	const check = new Date(Date.UTC(year, month - 1, day));
	if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

	return trimmed;
}

export function isValidIanaTimeZone(value: unknown): value is string {
	if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
	if (!value.includes('/')) return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
		return true;
	} catch {
		return false;
	}
}

export function deriveStartsAtUtc(localDateTime: unknown, timeZone: unknown): string | null {
	const parsed = parseEventLocalDateTime(localDateTime);
	if (!parsed || !isValidIanaTimeZone(timeZone)) return null;
	const utcDate = fromZonedTime(parsed, timeZone);
	return Number.isNaN(utcDate.getTime()) ? null : utcDate.toISOString();
}

export function isValidUtcIso(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return false;
	const date = new Date(value);
	return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

export function buildPublishedEventTiming(timing: EventTiming | undefined): EventTiming | undefined {
	if (!timing) return undefined;
	const localDateTime = parseEventLocalDateTime(timing.localDateTime);
	const timeZone = isValidIanaTimeZone(timing.timeZone) ? timing.timeZone : undefined;

	const result: EventTiming = {};
	if (localDateTime) result.localDateTime = localDateTime;
	if (timeZone) result.timeZone = timeZone;

	if (localDateTime && timeZone) {
		const utcDate = fromZonedTime(localDateTime, timeZone);
		if (!Number.isNaN(utcDate.getTime())) {
			result.startsAtUtc = utcDate.toISOString();
		}
	}

	return Object.keys(result).length > 0 ? result : undefined;
}

export function resolveCountdownTarget(
	timing: EventTiming | undefined,
	legacyHeroDate: unknown,
): CountdownTarget | null {
	if (isValidUtcIso(timing?.startsAtUtc)) {
		return { targetIso: timing.startsAtUtc, source: 'eventTiming' };
	}

	// Legacy fallback only: old published/demo content stored a floating event-local
	// date with a UTC suffix. Do not treat this path as a real event instant.
	if (isValidUtcIso(legacyHeroDate)) {
		return { targetIso: legacyHeroDate, source: 'legacyHeroDate' };
	}

	return null;
}


