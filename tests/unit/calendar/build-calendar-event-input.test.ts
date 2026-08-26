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

	it('includes location from the canonical venue collection', () => {
		const revealedLocation = {
			visibility: 'after-rsvp' as const,
			variant: 'standard' as const,
			mapStyle: 'dark' as const,
			venues: [
				{
					type: 'ceremony',
					venueEvent: 'Ceremonia',
					venueName: 'Salón García',
					address: 'Victoriano Huerta 51',
					date: '12 de diciembre de 2026',
					time: '18:00',
					googleMapsUrl: 'https://maps.example.com',
				},
			],
		};

		const result = buildCalendarEventInput({
			title,
			startsAt,
			revealedLocation,
		});
		expect(result!.location).toBeDefined();
		expect(result!.location!.venueName).toBe('Salón García');
		expect(result!.location!.address).toBe('Victoriano Huerta 51');
		expect(result!.location!.mapsUrl).toBe('https://maps.example.com');
	});

	it('includes location from revealedLocation with venues array', () => {
		const revealedLocation = {
			visibility: 'public' as const,
			variant: 'standard' as const,
			mapStyle: 'dark' as const,
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

	it('uses the first visible canonical venue', () => {
		const revealedLocation = {
			visibility: 'public' as const,
			variant: 'standard' as const,
			mapStyle: 'dark' as const,
			venues: [
				{
					type: 'reception',
					venueEvent: 'Recepción',
					venueName: 'Garden Palace',
					address: 'Macedio Ayala núm. 70',
					date: '12 de septiembre de 2026',
					time: '5:00 p. m.',
				},
			],
		};

		const result = buildCalendarEventInput({
			title: 'XV de Abril Michelle',
			description: 'Recepción de los XV años.',
			startsAt: '2026-09-12T23:00:00.000Z',
			timezone: 'America/Mexico_City',
			revealedLocation: revealedLocation as unknown as LocationSection,
		});

		expect(result).toMatchObject({
			title: 'XV de Abril Michelle',
			description: 'Recepción de los XV años.',
			startsAt: '2026-09-12T23:00:00.000Z',
			timezone: 'America/Mexico_City',
			location: {
				venueName: 'Garden Palace',
				address: 'Macedio Ayala núm. 70',
			},
		});
	});

	it('ignores hidden venues when selecting calendar location', () => {
		const revealedLocation = {
			visibility: 'public' as const,
			variant: 'standard' as const,
			mapStyle: 'dark' as const,
			venues: [
				{
					id: 'hidden',
					venueEvent: 'Ceremonia',
					venueName: 'Iglesia',
					address: 'Calle 123',
					date: '12 de diciembre de 2026',
					time: '18:00',
					isVisible: false,
				},
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
			variant: 'standard' as const,
			mapStyle: 'dark' as const,
			venues: [
				{
					type: 'ceremony',
					venueEvent: 'Ceremonia',
					venueName: '',
					address: '',
					date: '',
					time: '',
					googleMapsUrl: 'https://maps.example.com',
				},
			],
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
			variant: 'standard' as const,
			mapStyle: 'dark' as const,
			venues: [],
		};

		const result = buildCalendarEventInput({
			title,
			startsAt,
			revealedLocation,
		});
		expect(result!.location).toBeUndefined();
	});
});
