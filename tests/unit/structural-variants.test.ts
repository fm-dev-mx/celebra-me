import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import {
	FAMILY_STRUCTURAL_VARIANTS,
	GALLERY_LAYOUT_VARIANTS,
	GIFTS_STRUCTURAL_VARIANTS,
	HERO_STRUCTURAL_VARIANTS,
	LOCATION_STRUCTURAL_VARIANTS,
	PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS,
	RSVP_STRUCTURAL_VARIANTS,
	THANK_YOU_STRUCTURAL_VARIANTS,
} from '@/lib/invitation/structural-variants';

const baseInput = {
	eventType: 'xv',
	title: 'Variant contract fixture',
	isDemo: true,
	theme: { preset: 'jewelry-box' },
	hero: {
		name: 'Fixture',
		date: '2027-01-01T18:00:00.000Z',
		backgroundImage: '/fixture.webp',
		variant: 'standard',
	},
	quote: { text: 'Fixture quote' },
};

describe('section structural variant contracts', () => {
	it('keeps section-owned vocabularies explicit and semantic', () => {
		expect(HERO_STRUCTURAL_VARIANTS).toEqual(['standard', 'editorial-cover', 'split-cover']);
		expect(THANK_YOU_STRUCTURAL_VARIANTS).toContain('editorial-back-cover');
		expect(GIFTS_STRUCTURAL_VARIANTS).toContain('editorial-catalog');
		expect(RSVP_STRUCTURAL_VARIANTS).toContain('editorial-press-pass');
		expect(PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS).toContain('editorial-pass');
		expect(FAMILY_STRUCTURAL_VARIANTS).toContain('split-groups');
		expect(LOCATION_STRUCTURAL_VARIANTS).toContain('split-map');
		expect(GALLERY_LAYOUT_VARIANTS).toContain('magazine-spread');
	});

	it('rejects an unknown canonical variant instead of silently falling back', () => {
		const result = eventContentSchema.safeParse({
			...baseInput,
			hero: { ...baseInput.hero, variant: 'not-a-variant' },
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues).toEqual(
				expect.arrayContaining([expect.objectContaining({ path: ['hero', 'variant'] })]),
			);
		}
	});

	it('rejects canonical variants whose required section data is incompatible', () => {
		const familyResult = eventContentSchema.safeParse({
			...baseInput,
			family: {
				variant: 'split-groups',
				groups: [{ title: 'Only one group', items: [{ name: 'Person' }] }],
			},
		});
		const locationResult = eventContentSchema.safeParse({
			...baseInput,
			location: {
				variant: 'split-map',
				ceremony: {
					venueEvent: 'Ceremony',
					venueName: 'Venue',
					address: 'Address',
					date: '2027-01-01',
					time: '18:00',
				},
			},
		});

		expect(familyResult.success).toBe(false);
		expect(locationResult.success).toBe(false);
	});

	it('normalizes documented legacy aliases once at schema ingress', () => {
		const result = eventContentSchema.parse({
			...baseInput,
			theme: { preset: 'editorial-magazine' },
			hero: {
				...baseInput.hero,
				variant: 'editorial-magazine',
				structuralVariant: 'editorial-cover',
			},
			gallery: {
				variant: 'single',
				items: [{ image: '/fixture.webp' }],
			},
			itinerary: {
				presentation: { behavior: 'timeline-paper' },
				items: [{ iconName: 'Calendar', label: 'Evento', time: '18:00' }],
			},
		});

		expect(result.hero.variant).toBe('editorial-cover');
		expect(result.hero.visualVariant).toBe('editorial-magazine');
		expect(result.gallery?.variant).toBe('single-keepsake');
		expect(result.itinerary?.variant).toBe('timeline-paper');
		expect(result.hero).not.toHaveProperty('structuralVariant');
		expect(result.itinerary).not.toHaveProperty('presentation');
	});
});
