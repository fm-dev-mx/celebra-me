import { describe, it, expect } from '@jest/globals';
import { generateIcsString } from '@/lib/calendar/ics';
import type { CalendarEventInput } from '@/lib/calendar/types';

function makeInput(overrides: Partial<CalendarEventInput> = {}): CalendarEventInput {
	return {
		title: 'Test Event',
		startsAt: '2026-12-12T18:00:00.000Z',
		...overrides,
	};
}

describe('generateIcsString', () => {
	it('generates a valid .ics with required fields', () => {
		const result = generateIcsString(makeInput());

		expect(result).toContain('BEGIN:VCALENDAR');
		expect(result).toContain('VERSION:2.0');
		expect(result).toContain('PRODID:-//Celebra-me//Invitation Calendar//ES');
		expect(result).toContain('METHOD:PUBLISH');
		expect(result).toContain('BEGIN:VEVENT');
		expect(result).toContain('END:VEVENT');
		expect(result).toContain('END:VCALENDAR');
	});

	it('includes a UID', () => {
		const result = generateIcsString(makeInput());
		expect(result).toContain('UID:');
		expect(result).toContain('@celebra-me.com');
	});

	it('includes DTSTAMP', () => {
		const result = generateIcsString(makeInput());
		expect(result).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
	});

	it('formats DTSTART in UTC correctly', () => {
		const result = generateIcsString(makeInput());
		expect(result).toContain('DTSTART:20261212T180000Z');
	});

	it('includes SUMMARY with title containing &', () => {
		const result = generateIcsString(makeInput({ title: 'Boda de Ana & Carlos' }));
		expect(result).toContain('SUMMARY:Boda de Ana & Carlos');
	});

	it('escapes special characters in title', () => {
		const result = generateIcsString(makeInput({ title: 'Test; Comma, Back\\slash\nNewline' }));
		expect(result).toContain('SUMMARY:Test\\; Comma\\, Back\\\\slash\\nNewline');
	});

	it('includes DTEND when endsAt is provided', () => {
		const result = generateIcsString(makeInput({ endsAt: '2026-12-12T22:00:00.000Z' }));
		expect(result).toContain('DTEND:20261212T220000Z');
	});

	it('omits DTEND when endsAt is not provided', () => {
		const result = generateIcsString(makeInput({ endsAt: undefined }));
		expect(result).not.toContain('DTEND:');
	});

	it('includes DESCRIPTION when provided', () => {
		const result = generateIcsString(makeInput({ description: '¡Te esperamos!' }));
		expect(result).toContain('DESCRIPTION:¡Te esperamos!');
	});

	it('omits LOCATION when location data is absent', () => {
		const result = generateIcsString(makeInput({ location: undefined }));
		expect(result).not.toContain('LOCATION:');
	});

	it('includes LOCATION with venueName and address', () => {
		const result = generateIcsString(
			makeInput({
				location: {
					venueName: 'Salón García',
					address: 'Victoriano Huerta 51, Col. San Francisco, Uruapan',
				},
			}),
		);
		expect(result).toContain(
			'LOCATION:Salón García\\, Victoriano Huerta 51\\, Col. San Francisco\\, Uruapan',
		);
	});

	it('includes LOCATION with mapsUrl when present', () => {
		const result = generateIcsString(
			makeInput({
				location: {
					venueName: 'Salón García',
					mapsUrl: 'https://maps.example.com',
				},
			}),
		);
		expect(result).toContain('LOCATION:Salón García\\, https://maps.example.com');
	});

	it('includes VTIMEZONE when timezone is provided', () => {
		const result = generateIcsString(makeInput({ timezone: 'America/Mexico_City' }));
		expect(result).toContain('BEGIN:VTIMEZONE');
		expect(result).toContain('TZID:America/Mexico_City');
		expect(result).toContain('X-LIC-LOCATION:America/Mexico_City');
		expect(result).toContain('END:VTIMEZONE');
	});

	it('omits VTIMEZONE when timezone is not provided', () => {
		const result = generateIcsString(makeInput({ timezone: undefined }));
		expect(result).not.toContain('BEGIN:VTIMEZONE');
	});

	it('folds lines longer than 75 octets', () => {
		const longTitle = 'A'.repeat(100);
		const result = generateIcsString(makeInput({ title: longTitle }));
		const summaryLine = result.split('\r\n').find((l) => l.startsWith('SUMMARY:'));
		expect(summaryLine).toBeDefined();
		expect(summaryLine!.length).toBeLessThanOrEqual(76);
	});

	it('succeeds with minimal input (only title and startsAt)', () => {
		const input: CalendarEventInput = {
			title: 'Minimal',
			startsAt: '2026-06-01T12:00:00.000Z',
		};
		const result = generateIcsString(input);
		expect(result).toContain('SUMMARY:Minimal');
		expect(result).toContain('DTSTART:20260601T120000Z');
	});
});
