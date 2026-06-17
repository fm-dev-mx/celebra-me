import { describe, it, expect } from '@jest/globals';
import { buildCalendarEventInput } from '@/lib/calendar/build-calendar-event-input';
import type { LocationSection } from '@/lib/adapters/types';

describe('buildCalendarEventInput', () => {
	const title = 'Primera Comunión de Luna';
	const startsAt = '2026-12-12T18:00:00.000Z';

	it('returns a CalendarEventInput with startsAt from hero.date', () => {
		const result = buildCalendarEventInput({ title, startsAt });
		expect(result).not.toBeNull();
		expect(result!.title).toBe(title);
		expect(result!.startsAt).toBe(startsAt);
	});

	it('returns null when startsAt is missing', () => {
		const result = buildCalendarEventInput({ title, startsAt: undefined });
		expect(result).toBeNull();
	});

	it('returns null when startsAt is empty string', () => {
		const result = buildCalendarEventInput({ title, startsAt: '' });
		expect(result).toBeNull();
	});

	it('includes timezone when provided', () => {
		const result = buildCalendarEventInput({
			title,
			startsAt,
			timezone: 'America/Mexico_City',
		});
		expect(result!.timezone).toBe('America/Mexico_City');
	});

	it('omits timezone when not provided', () => {
		const result = buildCalendarEventInput({ title, startsAt });
		expect(result!.timezone).toBeUndefined();
	});

	it('includes fileName when provided', () => {
		const result = buildCalendarEventInput({ title, startsAt, fileName: 'luna-y-estrella' });
		expect(result!.fileName).toBe('luna-y-estrella');
	});

	it('omits location when revealedLocation is absent', () => {
		const result = buildCalendarEventInput({ title, startsAt });
		expect(result!.location).toBeUndefined();
	});

	it('includes location from revealedLocation with ceremony venue', () => {
		const revealedLocation = {
			visibility: 'after-rsvp' as const,
			ceremony: {
				venueEvent: 'Ceremonia',
				venueName: 'Salón García',
				address: 'Victoriano Huerta 51',
				date: '12 de diciembre de 2026',
				time: '18:00',
				googleMapsUrl: 'https://maps.example.com',
			},
		};

		const result = buildCalendarEventInput({
			title,
			startsAt,
			revealedLocation: revealedLocation as LocationSection,
		});
		expect(result!.location).toBeDefined();
		expect(result!.location!.venueName).toBe('Salón García');
		expect(result!.location!.address).toBe('Victoriano Huerta 51');
		expect(result!.location!.mapsUrl).toBe('https://maps.example.com');
	});

	it('includes location from revealedLocation with venues array', () => {
		const revealedLocation = {
			visibility: 'public' as const,
			venues: [
				{
					id: 'v1',
					venueEvent: 'Ceremonia',
					venueName: 'Iglesia Principal',
					address: 'Calle Real 123',
					date: '12 de diciembre de 2026',
					time: '18:00',
					googleMapsUrl: 'https://maps.example.com/iglesia',
					isVisible: true,
					sortOrder: 0,
				},
			],
		};

		const result = buildCalendarEventInput({
			title,
			startsAt,
			revealedLocation: revealedLocation as unknown as LocationSection,
		});
		expect(result!.location).toBeDefined();
		expect(result!.location!.venueName).toBe('Iglesia Principal');
		expect(result!.location!.mapsUrl).toBe('https://maps.example.com/iglesia');
	});

	it('prefers venue data from venues array over ceremony/reception', () => {
		const revealedLocation = {
			visibility: 'public' as const,
			venues: [
				{
					id: 'v1',
					venueEvent: 'Recepción',
					venueName: 'Salón de Fiestas',
					address: 'Av. Principal 456',
					date: '12 de diciembre de 2026',
					time: '20:00',
					googleMapsUrl: 'https://maps.example.com/salon',
					isVisible: true,
					sortOrder: 0,
				},
			],
			ceremony: {
				venueEvent: 'Ceremonia',
				venueName: 'Iglesia',
				address: 'Calle 123',
				date: '12 de diciembre de 2026',
				time: '18:00',
			},
			reception: {
				venueEvent: 'Recepción',
				venueName: 'Otro Salón',
				address: 'Otra dirección',
				date: '12 de diciembre de 2026',
				time: '20:00',
			},
		};

		const result = buildCalendarEventInput({
			title,
			startsAt,
			revealedLocation: revealedLocation as unknown as LocationSection,
		});
		expect(result!.location!.venueName).toBe('Salón de Fiestas');
	});

	it('includes location with only mapsUrl when no venueName', () => {
		const revealedLocation = {
			visibility: 'public' as const,
			ceremony: {
				venueEvent: 'Ceremonia',
				venueName: '',
				address: '',
				date: '',
				time: '',
				googleMapsUrl: 'https://maps.example.com',
			},
		};

		const result = buildCalendarEventInput({
			title,
			startsAt,
			revealedLocation: revealedLocation as unknown as LocationSection,
		});
		expect(result!.location).toBeDefined();
		expect(result!.location!.venueName).toBeUndefined();
		expect(result!.location!.address).toBeUndefined();
		expect(result!.location!.mapsUrl).toBe('https://maps.example.com');
	});

	it('handles revealedLocation with no venue data gracefully', () => {
		const revealedLocation = {
			visibility: 'public' as const,
		};

		const result = buildCalendarEventInput({
			title,
			startsAt,
			revealedLocation: revealedLocation as LocationSection,
		});
		expect(result!.location).toBeUndefined();
	});
});
