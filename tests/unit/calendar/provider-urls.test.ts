import { describe, expect, it } from '@jest/globals';
import {
	DEFAULT_PROVIDER_EVENT_DURATION_HOURS,
	buildGoogleCalendarUrl,
	buildOutlookCalendarUrl,
} from '@/lib/calendar/provider-urls';
import type { CalendarEventInput } from '@/lib/calendar/types';

function makeInput(overrides: Partial<CalendarEventInput> = {}): CalendarEventInput {
	return {
		title: 'Boda de Ana & Carlos',
		description: 'Ceremonia y recepción\nTe esperamos.',
		startsAt: '2026-08-02T03:00:00.000Z',
		timezone: 'America/Mazatlan',
		location: {
			venueName: 'Hacienda San José',
			address: 'Av. Flores 123',
			mapsUrl: 'https://maps.example.com/hacienda',
		},
		fileName: 'ana-carlos',
		...overrides,
	};
}

describe('calendar provider URLs', () => {
	it('builds Google Calendar URLs with UTC Z dates and no ctz parameter', () => {
		const url = new URL(
			buildGoogleCalendarUrl(makeInput({ endsAt: '2026-08-02T07:00:00.000Z' })),
		);

		expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
		expect(url.searchParams.get('action')).toBe('TEMPLATE');
		expect(url.searchParams.get('text')).toBe('Boda de Ana & Carlos');
		expect(url.searchParams.get('dates')).toBe('20260802T030000Z/20260802T070000Z');
		expect(url.searchParams.has('ctz')).toBe(false);
	});

	it('builds Outlook URLs against outlook.office.com', () => {
		const url = new URL(
			buildOutlookCalendarUrl(makeInput({ endsAt: '2026-08-02T07:00:00.000Z' })),
		);

		expect(url.origin + url.pathname).toBe(
			'https://outlook.office.com/calendar/deeplink/compose',
		);
		expect(url.searchParams.get('path')).toBe('/calendar/action/compose');
		expect(url.searchParams.get('rru')).toBe('addevent');
		expect(url.searchParams.get('subject')).toBe('Boda de Ana & Carlos');
		expect(url.searchParams.get('startdt')).toBe('2026-08-02T03:00:00Z');
		expect(url.searchParams.get('enddt')).toBe('2026-08-02T07:00:00Z');
	});

	it('includes details and full location text in provider URLs', () => {
		const google = new URL(buildGoogleCalendarUrl(makeInput()));
		const outlook = new URL(buildOutlookCalendarUrl(makeInput()));
		const expectedLocation =
			'Hacienda San José, Av. Flores 123, https://maps.example.com/hacienda';

		expect(google.searchParams.get('details')).toBe('Ceremonia y recepción\nTe esperamos.');
		expect(google.searchParams.get('location')).toBe(expectedLocation);
		expect(outlook.searchParams.get('body')).toBe('Ceremonia y recepción\nTe esperamos.');
		expect(outlook.searchParams.get('location')).toBe(expectedLocation);
	});

	it('omits optional location and details parameters when absent', () => {
		const google = new URL(
			buildGoogleCalendarUrl(makeInput({ description: undefined, location: undefined })),
		);
		const outlook = new URL(
			buildOutlookCalendarUrl(makeInput({ description: undefined, location: undefined })),
		);

		expect(google.searchParams.has('details')).toBe(false);
		expect(google.searchParams.has('location')).toBe(false);
		expect(outlook.searchParams.has('body')).toBe(false);
		expect(outlook.searchParams.has('location')).toBe(false);
	});

	it('uses DEFAULT_PROVIDER_EVENT_DURATION_HOURS as fallback when endsAt is missing', () => {
		const google = new URL(buildGoogleCalendarUrl(makeInput({ endsAt: undefined })));
		const outlook = new URL(buildOutlookCalendarUrl(makeInput({ endsAt: undefined })));

		expect(DEFAULT_PROVIDER_EVENT_DURATION_HOURS).toBe(2);
		expect(google.searchParams.get('dates')).toBe('20260802T030000Z/20260802T050000Z');
		expect(outlook.searchParams.get('enddt')).toBe('2026-08-02T05:00:00Z');
	});
});
