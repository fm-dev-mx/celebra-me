import {
	formatRsvpDeadlineEs,
	isIsoDate,
	isRsvpClosed,
	todayInZone,
	validateRsvpDeadline,
} from '@/lib/rsvp/rsvp-deadline';

const ZONE = 'America/Chihuahua'; // UTC-6, no daylight saving time.

describe('rsvp deadline rules', () => {
	it('accepts only real YYYY-MM-DD dates', () => {
		expect(isIsoDate('2026-11-20')).toBe(true);
		expect(isIsoDate('2026-02-30')).toBe(false);
		expect(isIsoDate('20/11/2026')).toBe(false);
		expect(isIsoDate(null)).toBe(false);
	});

	it('reads today in the event time zone, not in another zone', () => {
		const lateEvening = new Date('2026-11-21T05:00:00Z'); // 23:00 on Nov 20 in Chihuahua.
		expect(todayInZone(lateEvening, ZONE)).toBe('2026-11-20');
		expect(todayInZone(lateEvening, 'Europe/Madrid')).toBe('2026-11-21');
	});

	it('keeps RSVP open through the whole deadline day in the event time zone', () => {
		expect(isRsvpClosed('2026-11-20', ZONE, new Date('2026-11-21T05:59:00Z'))).toBe(false);
		expect(isRsvpClosed('2026-11-20', ZONE, new Date('2026-11-21T06:00:00Z'))).toBe(true);
	});

	it('falls back to the default zone for an unknown time zone', () => {
		expect(todayInZone(new Date('2026-11-21T05:00:00Z'), 'Not/AZone')).toBe('2026-11-20');
	});

	it('never closes RSVP without a deadline', () => {
		expect(isRsvpClosed(null, ZONE, new Date('2030-01-01T00:00:00Z'))).toBe(false);
	});

	it('reopens RSVP when the deadline is extended', () => {
		const now = new Date('2026-11-22T18:00:00Z');
		expect(isRsvpClosed('2026-11-20', ZONE, now)).toBe(true);
		expect(isRsvpClosed('2026-11-25', ZONE, now)).toBe(false);
	});

	it('rejects a deadline after the event date', () => {
		expect(
			validateRsvpDeadline({
				deadline: '2026-11-29',
				eventDate: '2026-11-28',
				timeZone: ZONE,
				now: new Date('2026-11-16T18:00:00Z'),
			}),
		).toEqual({ ok: false, reason: 'after_event' });
	});

	it('allows the event day itself as the deadline', () => {
		expect(
			validateRsvpDeadline({
				deadline: '2026-11-28',
				eventDate: '2026-11-28',
				timeZone: ZONE,
				now: new Date('2026-11-16T18:00:00Z'),
			}),
		).toEqual({ ok: true, deadline: '2026-11-28', past: false });
	});

	it('flags a deadline already over so the host can confirm it', () => {
		expect(
			validateRsvpDeadline({
				deadline: '2026-11-15',
				eventDate: '2026-11-28',
				timeZone: ZONE,
				now: new Date('2026-11-16T18:00:00Z'),
			}),
		).toEqual({ ok: true, deadline: '2026-11-15', past: true });
	});

	it('treats an empty value as clearing the deadline and rejects malformed input', () => {
		expect(validateRsvpDeadline({ deadline: '', eventDate: null, timeZone: ZONE })).toEqual({
			ok: true,
			deadline: null,
			past: false,
		});
		expect(
			validateRsvpDeadline({ deadline: 20261120, eventDate: null, timeZone: ZONE }),
		).toEqual({ ok: false, reason: 'format' });
	});

	it('formats the deadline in Spanish', () => {
		expect(formatRsvpDeadlineEs('2026-11-20')).toBe('20 de noviembre de 2026');
		expect(formatRsvpDeadlineEs('2026-01-05')).toBe('5 de enero de 2026');
		expect(formatRsvpDeadlineEs(null)).toBe('');
	});
});
