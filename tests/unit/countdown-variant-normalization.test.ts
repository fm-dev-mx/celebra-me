import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

function canonicalContent(overrides: Record<string, unknown> = {}) {
	return {
		eventType: 'xv',
		title: 'Prueba canónica',
		theme: { preset: 'editorial', fontFamily: 'serif' },
		sectionOrder: ['family', 'countdown', 'gallery', 'rsvp'],
		composition: { intersections: {} },
		hero: {
			name: 'Nombre',
			label: 'XV años',
			date: '2026-01-01T00:00:00.000Z',
			backgroundImage: 'hero',
			variant: 'standard',
		},
		family: {
			variant: 'standard',
			parents: { father: 'Padre', mother: 'Madre' },
		},
		countdown: { title: 'Cuenta', variant: 'standard' },
		gallery: { variant: 'uniform-grid', items: [{ image: 'gallery01' }] },
		rsvp: {
			variant: 'standard',
			personalizedAccess: { variant: 'standard' },
		},
		...overrides,
	};
}

describe('canonical section variants', () => {
	it('preserves explicit semantic variants without normalization', () => {
		const parsed = eventContentSchema.parse(
			canonicalContent({ countdown: { title: 'Cuenta', variant: 'hacienda-ornament' } }),
		);

		expect(parsed.countdown?.variant).toBe('hacienda-ornament');
	});

	it('rejects theme-named and legacy variant inputs', () => {
		expect(() =>
			eventContentSchema.parse(
				canonicalContent({ countdown: { title: 'Cuenta', variant: 'editorial' } }),
			),
		).toThrow();
		expect(() =>
			eventContentSchema.parse(
				canonicalContent({ sectionStyles: { countdown: { variant: 'editorial-folio' } } }),
			),
		).toThrow();
	});

	it('rejects a visible countdown without its explicit section variant', () => {
		expect(() =>
			eventContentSchema.parse(canonicalContent({ countdown: undefined })),
		).toThrow(/countdown\.variant is required/);
	});

	it('rejects theme-named interlude variants instead of ignoring them', () => {
		const result = eventContentSchema.safeParse(
			canonicalContent({
				interludes: [{ image: 'hero', afterSection: 'family', variant: 'editorial' }],
			}),
		);

		expect(result.success).toBe(false);
	});

	it('rejects the old gallery single alias instead of translating it', () => {
		expect(() =>
			eventContentSchema.parse(
				canonicalContent({ gallery: { variant: 'single', items: [{ image: 'gallery01' }] } }),
			),
		).toThrow();
	});

	it('requires a photo for full-bleed thank-you', () => {
		expect(() =>
			eventContentSchema.parse(
				canonicalContent({
					thankYou: { variant: 'full-bleed-photo', message: 'Gracias', closingName: 'Nombre' },
				}),
			),
		).toThrow(/full-bleed-photo/);
	});
});
