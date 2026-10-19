export const COUNTDOWN_UNITS = ['days', 'hours', 'minutes', 'seconds'] as const;

export type CountdownUnit = (typeof COUNTDOWN_UNITS)[number];

/**
 * What the day segment counts: calendar days (default) or nights, for evening celebrations that
 * read as "Faltan 43 noches". Only the label changes; the value is the same day difference.
 */
export const COUNTDOWN_DAY_UNITS = ['days', 'nights'] as const;

export type CountdownDayUnit = (typeof COUNTDOWN_DAY_UNITS)[number];

/** Line-art mark drawn around the event day of the countdown calendar. */
export const COUNTDOWN_CALENDAR_MARKS = ['sun', 'heart', 'ring'] as const;

export type CountdownCalendarMark = (typeof COUNTDOWN_CALENDAR_MARKS)[number];

export function resolveCountdownDayLabel(dayUnit: CountdownDayUnit | undefined): string {
	return dayUnit === 'nights' ? 'Noches' : 'Días';
}

export interface CountdownPresentationOptions {
	/** Subset of countdown units to render. Absent/undefined → all four units. */
	visibleUnits?: CountdownUnit[];
}

const COUNTDOWN_UNIT_SET = new Set<string>(COUNTDOWN_UNITS);

/**
 * Resolve countdown visible units. Absent options → all units.
 * Unknown units are dropped. An empty/invalid selection falls back to all units
 * so the section never renders with zero segments at runtime; schemas reject
 * empty arrays at the content boundary.
 */
export function resolveCountdownVisibleUnits(
	options: CountdownPresentationOptions | undefined,
): CountdownUnit[] {
	const requested = options?.visibleUnits;
	if (!requested || requested.length === 0) {
		return [...COUNTDOWN_UNITS];
	}
	const unique = [
		...new Set(requested.filter((unit): unit is CountdownUnit => COUNTDOWN_UNIT_SET.has(unit))),
	];
	return unique.length > 0 ? unique : [...COUNTDOWN_UNITS];
}

export type CountdownTimeLeft = Record<CountdownUnit, number>;

/** Whole days, hours, minutes and seconds left until `targetMs`; all zero once it has passed. */
export function computeTimeLeft(targetMs: number, nowMs: number): CountdownTimeLeft {
	const difference = targetMs - nowMs;
	if (difference <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
	return {
		days: Math.floor(difference / (1000 * 60 * 60 * 24)),
		hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
		minutes: Math.floor((difference / 1000 / 60) % 60),
		seconds: Math.floor((difference / 1000) % 60),
	};
}
