import { adaptEvent } from '@/lib/adapters/event';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

const baseItinerary = {
	variant: 'standard',
	title: 'Programa',
	items: [
		{
			time: '10:00',
			label: 'Inicio',
			iconName: 'HeartSeal' as const,
		},
	],
};

function eventWith(overrides: Record<string, unknown>) {
	return {
		id: 'events/itinerary-contract',
		data: {
			eventType: 'xv',
			title: 'Itinerario',
			theme: { preset: 'luxury-hacienda' },
			sectionOrder: ['itinerary', 'rsvp'],
			composition: { intersections: {} },
			hero: {
				name: 'Celebrante',
				date: '2027-11-20',
				backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
				variant: 'standard',
			},
			itinerary: baseItinerary,
			rsvp: { variant: 'standard', personalizedAccess: { variant: 'standard' } },
			...overrides,
		},
	} as Parameters<typeof adaptEvent>[0];
}

describe('itinerary canonical variant contract', () => {
	it('preserves an explicit canonical standard variant through the adapter', () => {
		const viewModel = adaptEvent(eventWith({}));
		expect(viewModel.sections.itinerary?.variant).toBe('standard');
	});

	it('preserves an explicit non-default variant through the adapter', () => {
		const viewModel = adaptEvent(
			eventWith({ itinerary: { ...baseItinerary, variant: 'editorial-program' } }),
		);
		expect(viewModel.sections.itinerary?.variant).toBe('editorial-program');
	});

	it('rejects the removed presentation behavior alias', () => {
		const result = eventContentSchema.safeParse(
			eventWith({ itinerary: { ...baseItinerary, presentation: { behavior: 'standard' } } }).data,
		);
		expect(result.success).toBe(false);
	});

	it('rejects theme-named sectionStyles instead of treating them as itinerary authority', () => {
		const result = eventContentSchema.safeParse(
			eventWith({ sectionStyles: { itinerary: { variant: 'celestial-blue' } } }).data,
		);
		expect(result.success).toBe(false);
	});
});
