import { adaptEvent } from '@/lib/adapters/event';

const baseItinerary = {
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
			hero: {
				name: 'Celebrante',
				date: '2027-11-20',
				backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
			},
			itinerary: baseItinerary,
			...overrides,
		},
	} as Parameters<typeof adaptEvent>[0];
}

describe('itinerary canonical behavior adapter', () => {
	it('uses neutral standard behavior instead of inferring the theme', () => {
		const viewModel = adaptEvent(eventWith({}));
		expect(viewModel.sections.itinerary?.variant).toBe('standard');
	});

	it('lets explicit presentation behavior select the structural renderer', () => {
		const viewModel = adaptEvent(
			eventWith({
				itinerary: { ...baseItinerary, presentation: { behavior: 'timeline-paper' } },
			}),
		);
		expect(viewModel.sections.itinerary?.variant).toBe('timeline-paper');
	});

	it('keeps the legacy celestial-blue alias only when canonical behavior is absent', () => {
		const viewModel = adaptEvent(
			eventWith({ sectionStyles: { itinerary: { variant: 'celestial-blue' } } }),
		);
		expect(viewModel.sections.itinerary?.variant).toBe('timeline-paper');
	});
});
