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

	it('ends the entry after the venue duration, past midnight when it runs late', () => {
		const links = buildVenueCalendarLinks(
			{ ...venue, time: '20:00', durationMinutes: 300 },
			{ eventTitle: 'Nuestra boda', timeZone: 'America/Mexico_City' },
		);
		// 20:00 to 01:00 in Mexico City (UTC-6) is 02:00Z to 07:00Z on the next day.
		expect(links?.googleUrl).toContain('dates=20261207T020000Z%2F20261207T070000Z');
		expect(decodeURIComponent(links?.icsHref ?? '')).toContain('DTEND:20261207T070000Z');
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
