import { itinerarySchema as draftItinerarySchema } from '@/lib/intake/schemas/shared-content.schema';
import { canonicalizeItineraryDraft } from '@/lib/intake/services/draft-section-mappers';
import { itinerarySchema } from '@/lib/schemas/content/itinerary.schema';

const baseItinerary = {
	title: 'Programa',
	variant: 'editorial-program' as const,
	items: [{ iconName: 'Party' as const, label: 'Cierre', time: '02:00' }],
};

describe('itinerary closingNote', () => {
	it('is optional in published content', () => {
		expect(itinerarySchema.parse(baseItinerary)?.closingNote).toBeUndefined();
		expect(
			itinerarySchema.parse({ ...baseItinerary, closingNote: 'Habrá muchas sorpresas.' })
				?.closingNote,
		).toBe('Habrá muchas sorpresas.');
	});

	it('is accepted by the strict draft schema', () => {
		const result = draftItinerarySchema.safeParse({
			...baseItinerary,
			closingNote: 'Habrá muchas sorpresas.',
		});
		expect(result.success).toBe(true);
	});

	it('survives draft canonicalization', () => {
		expect(
			canonicalizeItineraryDraft({
				...baseItinerary,
				closingNote: 'Habrá muchas sorpresas.',
			}),
		).toMatchObject({ closingNote: 'Habrá muchas sorpresas.' });
		expect(canonicalizeItineraryDraft(baseItinerary)).not.toHaveProperty('closingNote');
	});
});
