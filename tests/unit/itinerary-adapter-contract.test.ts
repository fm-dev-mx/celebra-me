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
	it('defaults to standard when presentation.behavior is omitted', () => {
		const viewModel = adaptEvent(eventWith({ theme: { preset: 'jewelry-box-wedding' } }));
		expect(viewModel.sections.itinerary?.variant).toBe('standard');
	});

	it('uses neutral standard behavior when the canonical presentation is explicit', () => {
		const viewModel = adaptEvent(
			eventWith({ itinerary: { ...baseItinerary, presentation: { behavior: 'standard' } } }),
		);
		expect(viewModel.sections.itinerary?.variant).toBe('standard');
	});

	it('gives explicit canonical behavior precedence over a legacy sectionStyles variant', () => {
		const viewModel = adaptEvent(
			eventWith({
				itinerary: { ...baseItinerary, presentation: { behavior: 'standard' } },
				sectionStyles: { itinerary: { variant: 'celestial-blue' } },
			}),
		);
		expect(viewModel.sections.itinerary?.variant).toBe('standard');
	});

	it('lets explicit editorial-program variant select TimelineList behavior', () => {
		const viewModel = adaptEvent(
			eventWith({ itinerary: { ...baseItinerary, variant: 'editorial-program' } }),
		);
		expect(viewModel.sections.itinerary?.variant).toBe('editorial-program');
	});

	it('lets explicit presentation behavior select the structural renderer', () => {
		const viewModel = adaptEvent(
			eventWith({
				itinerary: { ...baseItinerary, presentation: { behavior: 'timeline-paper' } },
			}),
		);
		expect(viewModel.sections.itinerary?.variant).toBe('timeline-paper');
	});

	it('does not treat legacy celestial-blue sectionStyles as itinerary authority', () => {
		const viewModel = adaptEvent(
			eventWith({ sectionStyles: { itinerary: { variant: 'celestial-blue' } } }),
		);
		expect(viewModel.sections.itinerary?.variant).toBe('standard');
	});
});
