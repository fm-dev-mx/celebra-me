import { buildEventCalendarMonth, EVENT_CALENDAR_WEEKDAYS } from '@/lib/invitation/event-calendar';

describe('buildEventCalendarMonth', () => {
	it('lists Monday-first weekday initials', () => {
		expect(EVENT_CALENDAR_WEEKDAYS).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
	});

	it('builds the month title and flags the event day', () => {
		const month = buildEventCalendarMonth('2026-11-21T20:00');

		expect(month).toMatchObject({ title: 'noviembre 2026', eventDay: 21 });
	});

	it('pads leading blanks so the first day lands on its Monday-first column', () => {
		// 1 Nov 2026 is a Sunday: six blanks, then day 1 in the last column.
		const sunday = buildEventCalendarMonth('2026-11-21');
		expect(sunday?.weeks[0]).toEqual([null, null, null, null, null, null, 1]);

		// 1 Jun 2026 is a Monday: no leading blanks.
		const monday = buildEventCalendarMonth('2026-06-15');
		expect(monday?.weeks[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);

		// 1 Jan 2026 is a Thursday: three blanks.
		const thursday = buildEventCalendarMonth('2026-01-10');
		expect(thursday?.weeks[0]).toEqual([null, null, null, 1, 2, 3, 4]);
	});

	it('returns full weeks, trailing blanks and every day exactly once', () => {
		const month = buildEventCalendarMonth('2026-11-21');
		if (!month) throw new Error('Expected a calendar month');

		expect(month.weeks.every((week) => week.length === 7)).toBe(true);
		const days = month.weeks.flat().filter((cell): cell is number => cell !== null);
		expect(days).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
		expect(month.weeks[month.weeks.length - 1]).toEqual([
			30,
			null,
			null,
			null,
			null,
			null,
			null,
		]);
	});

	it('handles leap-year February', () => {
		const month = buildEventCalendarMonth('2028-02-29');
		const days = month?.weeks.flat().filter((cell) => cell !== null);

		expect(month).toMatchObject({ title: 'febrero 2028', eventDay: 29 });
		expect(days).toHaveLength(29);
	});

	it('returns undefined for malformed or impossible dates', () => {
		expect(buildEventCalendarMonth('')).toBeUndefined();
		expect(buildEventCalendarMonth('20 de noviembre')).toBeUndefined();
		expect(buildEventCalendarMonth('2026-13-01')).toBeUndefined();
		expect(buildEventCalendarMonth('2026-00-10')).toBeUndefined();
		expect(buildEventCalendarMonth('2026-02-30')).toBeUndefined();
		expect(buildEventCalendarMonth('2026-11-00')).toBeUndefined();
	});
});
