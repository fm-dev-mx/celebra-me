import { groupVenues, type VenueEntry } from '@/lib/invitation/location-helper';

describe('groupVenues', () => {
	it('returns the same array if empty or single venue', () => {
		expect(groupVenues([])).toEqual([]);

		const singleVenue: VenueEntry = {
			venueEvent: 'Ceremonia',
			venueName: 'Iglesia',
			address: 'Calle 123',
			date: '2026-08-29',
			time: '15:00',
			googleMapsUrl: 'https://maps.google.com/?q=church',
		};
		expect(groupVenues([singleVenue])).toEqual([singleVenue]);
	});

	it('groups venues with the same googleMapsUrl', () => {
		const venues: VenueEntry[] = [
			{
				venueEvent: 'Ceremonia religiosa',
				venueName: 'Finca Las Palmas',
				address: 'Huexotla, Texcoco',
				date: '2026-08-29',
				time: '3:45 p.m.',
				googleMapsUrl: 'https://maps.google.com/?q=finca',
			},
			{
				venueEvent: 'Recepción',
				venueName: 'Finca Las Palmas',
				address: 'Huexotla, Texcoco',
				date: '2026-08-29',
				time: '4:30 p.m.',
				googleMapsUrl: 'https://maps.google.com/?q=finca',
			},
		];

		const result = groupVenues(venues);
		expect(result).toHaveLength(1);
		expect(result[0].venueEvent).toBe('ITINERARIO EN SEDE');
		expect(result[0].type).toBe('grouped');
		expect(result[0].events).toEqual([
			{ name: 'Ceremonia religiosa', time: '3:45 p.m.' },
			{ name: 'Recepción', time: '4:30 p.m.' },
		]);
	});

	it('groups venues using normalized name + address fallback when googleMapsUrl is missing', () => {
		const venues: VenueEntry[] = [
			{
				venueEvent: 'Ceremonia',
				venueName: ' Finca Las Palmas ',
				address: ' Huexotla, Texcoco ',
				date: '2026-08-29',
				time: '3:45 p.m.',
			},
			{
				venueEvent: 'Recepción',
				venueName: 'finca las palmas',
				address: 'huexotla, texcoco',
				date: '2026-08-29',
				time: '4:30 p.m.',
			},
		];

		const result = groupVenues(venues);
		expect(result).toHaveLength(1);
		expect(result[0].venueEvent).toBe('ITINERARIO EN SEDE');
		expect(result[0].events).toHaveLength(2);
	});

	it('does not group different venues', () => {
		const venues: VenueEntry[] = [
			{
				venueEvent: 'Ceremonia',
				venueName: 'Iglesia',
				address: 'Calle Falsa 123',
				date: '2026-08-29',
				time: '15:00',
				googleMapsUrl: 'https://maps.google.com/?q=church',
			},
			{
				venueEvent: 'Recepción',
				venueName: 'Salón de Fiestas',
				address: 'Avenida Siempre Viva 742',
				date: '2026-08-29',
				time: '19:00',
				googleMapsUrl: 'https://maps.google.com/?q=hall',
			},
		];

		const result = groupVenues(venues);
		expect(result).toHaveLength(2);
		expect(result[0].venueName).toBe('Iglesia');
		expect(result[1].venueName).toBe('Salón de Fiestas');
	});
});
