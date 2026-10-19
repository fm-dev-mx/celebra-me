/**
 * Month grid of an event-local date for the countdown calendar. Pure calendar arithmetic on the
 * `YYYY-MM-DD` part of `eventTiming.localDateTime`, so it never depends on the server time zone.
 */
const MONTH_NAMES = [
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

/** Monday-first weekday initials, as Mexican stationery prints them. */
export const EVENT_CALENDAR_WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

export interface EventCalendarMonth {
	/** Month and year, e.g. `noviembre 2026` (styled in capitals). */
	title: string;
	/** Weeks of seven cells; `null` pads the days outside the month. */
	weeks: (number | null)[][];
	eventDay: number;
}

export function buildEventCalendarMonth(localDateTime: string): EventCalendarMonth | undefined {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(localDateTime);
	if (!match) return undefined;
	const year = Number(match[1]);
	const monthIndex = Number(match[2]) - 1;
	const eventDay = Number(match[3]);
	if (monthIndex < 0 || monthIndex > 11) return undefined;

	const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
	if (eventDay < 1 || eventDay > daysInMonth) return undefined;
	// getUTCDay: 0 = Sunday; shift so Monday is column 0.
	const leading = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;

	const cells: (number | null)[] = [
		...Array.from({ length: leading }, () => null),
		...Array.from({ length: daysInMonth }, (_, index) => index + 1),
	];
	while (cells.length % 7 !== 0) cells.push(null);

	const weeks: (number | null)[][] = [];
	for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));

	return { title: `${MONTH_NAMES[monthIndex]} ${year}`, weeks, eventDay };
}
