import { describe, it, expect } from '@jest/globals';
import { parseTime, normalizeTime, isValidTime } from '@/lib/intake/utils';
import {
	buildPublishedEventTiming,
	deriveStartsAtUtc,
	isValidIanaTimeZone,
	parseEventLocalDateTime,
	resolveCountdownTarget,
} from '@/lib/time/event-time';

describe('parseTime', () => {
	describe('valid 24-hour format (HH:mm)', () => {
		it('parses midnight correctly', () => {
			expect(parseTime('00:00')).toEqual({ hours: 0, minutes: 0 });
		});

		it('parses noon correctly', () => {
			expect(parseTime('12:00')).toEqual({ hours: 12, minutes: 0 });
		});

		it('parses late afternoon correctly', () => {
			expect(parseTime('18:30')).toEqual({ hours: 18, minutes: 30 });
		});

		it('parses end of day correctly', () => {
			expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
		});

		it('parses single-digit hour correctly', () => {
			expect(parseTime('09:05')).toEqual({ hours: 9, minutes: 5 });
		});
	});

	describe('valid 12-hour format (h:mm AM/PM)', () => {
		it('parses midnight (12:00 AM) correctly', () => {
			expect(parseTime('12:00 AM')).toEqual({ hours: 0, minutes: 0 });
		});

		it('parses 1:00 AM correctly', () => {
			expect(parseTime('1:00 AM')).toEqual({ hours: 1, minutes: 0 });
		});

		it('parses noon (12:00 PM) correctly', () => {
			expect(parseTime('12:00 PM')).toEqual({ hours: 12, minutes: 0 });
		});

		it('parses 6:00 PM correctly', () => {
			expect(parseTime('6:00 PM')).toEqual({ hours: 18, minutes: 0 });
		});

		it('parses 11:59 PM correctly', () => {
			expect(parseTime('11:59 PM')).toEqual({ hours: 23, minutes: 59 });
		});

		it('parses 1:00 PM correctly', () => {
			expect(parseTime('1:00 PM')).toEqual({ hours: 13, minutes: 0 });
		});

		it('parses 9:30 AM correctly', () => {
			expect(parseTime('9:30 AM')).toEqual({ hours: 9, minutes: 30 });
		});

		it('parses with lowercase am/pm', () => {
			expect(parseTime('6:00 pm')).toEqual({ hours: 18, minutes: 0 });
			expect(parseTime('6:00 am')).toEqual({ hours: 6, minutes: 0 });
		});
	});

	describe('invalid values', () => {
		it('returns null for impossible hours (99:00)', () => {
			expect(parseTime('99:00')).toBeNull();
		});

		it('returns null for impossible minutes (8:75)', () => {
			expect(parseTime('8:75')).toBeNull();
		});

		it('returns null for invalid hour in 12h format (13:00 PM)', () => {
			expect(parseTime('13:00 PM')).toBeNull();
		});

		it('returns null for impossible 12h hour (0:00 AM)', () => {
			expect(parseTime('0:00 AM')).toBeNull();
		});

		it('returns null for null input', () => {
			expect(parseTime(null)).toBeNull();
		});

		it('returns null for undefined input', () => {
			expect(parseTime(undefined)).toBeNull();
		});

		it('returns null for empty string', () => {
			expect(parseTime('')).toBeNull();
		});

		it('returns null for random strings', () => {
			expect(parseTime('invalid')).toBeNull();
			expect(parseTime('8:00')).toBeNull(); // missing AM/PM
		});
	});
});

describe('normalizeTime', () => {
	describe('24-hour format passthrough', () => {
		it('returns uppercase HH:mm for valid 24h times', () => {
			expect(normalizeTime('20:00')).toBe('20:00');
			expect(normalizeTime('08:00')).toBe('08:00');
			expect(normalizeTime('00:00')).toBe('00:00');
			expect(normalizeTime('23:59')).toBe('23:59');
		});
	});

	describe('12-hour format conversion', () => {
		it('converts 12-hour times to 24-hour format', () => {
			expect(normalizeTime('8:00 PM')).toBe('20:00');
			expect(normalizeTime('6:00 PM')).toBe('18:00');
			expect(normalizeTime('9:30 PM')).toBe('21:30');
			expect(normalizeTime('1:00 AM')).toBe('01:00');
			expect(normalizeTime('12:00 AM')).toBe('00:00');
			expect(normalizeTime('12:00 PM')).toBe('12:00');
		});
	});

	describe('invalid values', () => {
		it('returns undefined for invalid times', () => {
			expect(normalizeTime('99:00')).toBeUndefined();
			expect(normalizeTime('8:75')).toBeUndefined();
			expect(normalizeTime('13:00 PM')).toBeUndefined();
			expect(normalizeTime('invalid')).toBeUndefined();
			expect(normalizeTime('')).toBeUndefined();
			expect(normalizeTime(null)).toBeUndefined();
		});
	});
});

describe('isValidTime', () => {
	it('returns true for valid 24-hour times', () => {
		expect(isValidTime('00:00')).toBe(true);
		expect(isValidTime('12:00')).toBe(true);
		expect(isValidTime('23:59')).toBe(true);
	});

	it('returns true for valid 12-hour times', () => {
		expect(isValidTime('12:00 AM')).toBe(true);
		expect(isValidTime('6:00 PM')).toBe(true);
		expect(isValidTime('1:00 AM')).toBe(true);
	});

	it('returns false for invalid times', () => {
		expect(isValidTime('99:00')).toBe(false);
		expect(isValidTime('8:75')).toBe(false);
		expect(isValidTime('13:00 PM')).toBe(false);
		expect(isValidTime('invalid')).toBe(false);
		expect(isValidTime('')).toBe(false);
		expect(isValidTime(null)).toBe(false);
	});
});

describe('eventTiming utilities', () => {
	it('converts Mexico Pacific local time to the correct UTC instant', () => {
		expect(deriveStartsAtUtc('2026-08-01T20:00', 'America/Mazatlan')).toBe(
			'2026-08-02T03:00:00.000Z',
		);
	});

	it('documents DST-sensitive conversion for Tijuana summer time', () => {
		expect(deriveStartsAtUtc('2026-07-01T20:00', 'America/Tijuana')).toBe(
			'2026-07-02T03:00:00.000Z',
		);
	});

	it('fails safely for invalid IANA zones', () => {
		expect(isValidIanaTimeZone('America/Mazatlan')).toBe(true);
		expect(isValidIanaTimeZone('GMT-7')).toBe(false);
		expect(deriveStartsAtUtc('2026-08-01T20:00', 'GMT-7')).toBeNull();
	});

	it('treats localDateTime as a strict event-local value, not an instant', () => {
		expect(parseEventLocalDateTime('2026-08-01T20:00')).toBe('2026-08-01T20:00');
		expect(parseEventLocalDateTime('2026-08-01T20:00:00')).toBeNull();
		expect(parseEventLocalDateTime('2026-08-01T20:00Z')).toBeNull();
		expect(parseEventLocalDateTime('2026-08-01T20:00-07:00')).toBeNull();
	});

	it('rejects impossible calendar dates like June 31', () => {
		expect(parseEventLocalDateTime('2026-06-31T20:00')).toBeNull();
	});

	it('rejects April 31', () => {
		expect(parseEventLocalDateTime('2026-04-31T20:00')).toBeNull();
	});

	it('rejects February 30', () => {
		expect(parseEventLocalDateTime('2026-02-30T20:00')).toBeNull();
	});

	it('rejects February 29 in a non-leap year', () => {
		expect(parseEventLocalDateTime('2025-02-29T20:00')).toBeNull();
	});

	it('accepts February 29 in a leap year', () => {
		expect(parseEventLocalDateTime('2028-02-29T20:00')).toBe('2028-02-29T20:00');
	});

	it('buildPublishedEventTiming drops fields that fail validation', () => {
		expect(buildPublishedEventTiming({ localDateTime: 'not-valid', timeZone: 'America/Mazatlan' })).toEqual({
			timeZone: 'America/Mazatlan',
		});
		expect(buildPublishedEventTiming({ localDateTime: '2026-08-01T20:00', timeZone: 'GMT-7' })).toEqual({
			localDateTime: '2026-08-01T20:00',
		});
		expect(buildPublishedEventTiming({ localDateTime: '2026-08-01T20:00', timeZone: 'America/Mazatlan' })).toEqual({
			localDateTime: '2026-08-01T20:00',
			timeZone: 'America/Mazatlan',
			startsAtUtc: '2026-08-02T03:00:00.000Z',
		});
	});

	it('buildPublishedEventTiming returns undefined for empty input', () => {
		expect(buildPublishedEventTiming(undefined)).toBeUndefined();
		expect(buildPublishedEventTiming({})).toBeUndefined();
	});

	it('centralizes countdown target resolution and marks legacy fallback', () => {
		expect(
			resolveCountdownTarget(
				{ localDateTime: '2026-08-01T20:00', timeZone: 'America/Mazatlan', startsAtUtc: '2026-08-02T03:00:00.000Z' },
				'2026-08-01T20:00:00.000Z',
			),
		).toEqual({ targetIso: '2026-08-02T03:00:00.000Z', source: 'eventTiming' });

		expect(resolveCountdownTarget(undefined, '2026-08-01T20:00:00.000Z')).toEqual({
			targetIso: '2026-08-01T20:00:00.000Z',
			source: 'legacyHeroDate',
		});
	});
});
