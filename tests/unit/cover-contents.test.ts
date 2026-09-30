import { buildCoverContents } from '@/lib/invitation/cover-contents';
import type { InvitationViewModel } from '@/lib/adapters/types';

const viewModel = (sections: Record<string, unknown>, sectionOrder: string[]) =>
	({ sections, sectionOrder }) as unknown as InvitationViewModel;

describe('collector cover contents', () => {
	it('lists sections in order with their own titles and magazine page numbers', () => {
		const entries = buildCoverContents(
			viewModel(
				{
					quote: { text: 'x' },
					family: {
						labels: { sectionTitle: 'Gracias, Dios', sectionSubtitle: 'Mi oración' },
					},
					countdown: {},
					itinerary: { title: 'Programa', items: [{}, {}, {}, {}, {}] },
					gallery: { title: 'Momentos icónicos.', eyebrow: 'Galería' },
					rsvp: {},
				},
				[
					'quote',
					'family',
					'countdown',
					'itinerary',
					'gallery',
					'personalizedAccess',
					'rsvp',
				],
			),
		);
		expect(entries).toEqual([
			{ label: 'Gracias, Dios', kicker: 'Mi oración', page: '04' },
			{ label: 'Programa', kicker: 'Programa', deck: '5 momentos de la noche', page: '07' },
			{ label: 'Momentos icónicos', kicker: 'Galería', page: '10' },
			{ label: 'Confirmación', kicker: 'Confirmación', page: '13' },
		]);
	});

	it('falls back to generic labels and skips sections that are not rendered', () => {
		const entries = buildCoverContents(
			viewModel({ family: {}, location: {} }, ['family', 'itinerary', 'location']),
		);
		expect(entries).toEqual([
			{ label: 'Familia', kicker: 'Familia', page: '04' },
			{ label: 'Lugar', kicker: 'Lugar', page: '07' },
		]);
	});
});
