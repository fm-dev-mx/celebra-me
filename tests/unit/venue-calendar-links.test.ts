import { buildVenueCalendarLinks } from '@/lib/calendar/venue-calendar-links';

const venue = {
	venueEvent: 'Recepción',
	venueName: 'Salón de prueba',
	address: 'Calle 1, Centro',
	date: '2026-12-06',
	time: '19:00',
};

describe('buildVenueCalendarLinks', () => {
	it('resolves the venue local time in the event time zone', () => {
		const links = buildVenueCalendarLinks(venue, {
			eventTitle: 'Mis XV años',
			timeZone: 'America/Monterrey',
		});

		expect(links).not.toBeNull();
		// 19:00 in Monterrey (UTC-6, no DST) is 01:00Z the next day.
		expect(links?.googleUrl).toContain('dates=20261207T010000Z');
		expect(decodeURIComponent(links?.icsHref ?? '')).toContain('DTSTART:20261207T010000Z');
		expect(links?.icsFileName).toBe('mis-xv-anos-recepcion.ics');
	});

	it('accepts legacy Spanish prose for date and time', () => {
		const links = buildVenueCalendarLinks(
			{ ...venue, date: '6 de diciembre de 2026', time: '5:00 p. m.' },
			{ eventTitle: 'Mis XV años', timeZone: 'America/Monterrey' },
		);
		expect(links?.googleUrl).toContain('dates=20261206T230000Z');
	});

	it('offers nothing without a time zone or a parseable time', () => {
		expect(buildVenueCalendarLinks(venue, { eventTitle: 'Mis XV años' })).toBeNull();
		expect(
			buildVenueCalendarLinks(
				{ ...venue, time: 'por confirmar' },
				{ eventTitle: 'Mis XV años', timeZone: 'America/Monterrey' },
			),
		).toBeNull();
	});
});
