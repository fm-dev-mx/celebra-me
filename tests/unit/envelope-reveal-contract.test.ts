import { buildOpeningViewModel, buildRevealCard } from '@/lib/invitation/reveal-card';

describe('buildRevealCard', () => {
	it('builds the canonical reveal card data with defaults', () => {
		expect(
			buildRevealCard({
				name: 'Ximena',
				date: '2026-04-25',
			}),
		).toEqual({
			label: 'Invitación',
			primaryName: 'Ximena',
			secondaryName: undefined,
			date: '25 · ABR · 2026',
			guestLabel: 'Entrega especial para:',
			guestName: undefined,
			tagline: undefined,
		});
	});

	it('passes through label and tagline when provided', () => {
		const card = buildRevealCard({
			name: 'Leah Lexa',
			date: '2026-06-21',
			label: 'BABY SHOWER',
			tagline: 'Una celebración celestial',
		});
		expect(card.label).toBe('BABY SHOWER');
		expect(card.tagline).toBe('Una celebración celestial');
		expect(card.date).toBe('21 · JUN · 2026');
	});

	it('falls back to default label when label is not provided', () => {
		const card = buildRevealCard({
			name: 'Test',
			date: '2026-01-01',
		});
		expect(card.label).toBe('Invitación');
	});

	it('sets tagline to undefined when not provided', () => {
		const card = buildRevealCard({
			name: 'Test',
			date: '2026-01-01',
		});
		expect(card.tagline).toBeUndefined();
	});

	it('preserves guestName when provided', () => {
		const card = buildRevealCard({
			name: 'Test',
			date: '2026-01-01',
			guestName: 'María García',
		});
		expect(card.guestName).toBe('María García');
	});

	it('formats the date in uppercase dot-separated Spanish format', () => {
		const card = buildRevealCard({
			name: 'Test',
			date: '2026-12-25',
		});
		expect(card.date).toBe('25 · DIC · 2026');
	});
});

describe('buildOpeningViewModel', () => {
	it('derives closed envelope and reveal-card names from two canonical honorees', () => {
		const opening = buildOpeningViewModel({
			hero: {
				name: 'Luna Yamileth',
				secondaryName: 'Estrella Abigail',
				label: 'Primera Comunión',
				date: '2026-08-01T20:00:00.000Z',
			},
			envelope: {},
		});

		expect(opening.envelope.name).toBe('Luna Yamileth y Estrella Abigail');
		expect(opening.card.primaryName).toBe('Luna Yamileth');
		expect(opening.card.secondaryName).toBe('Estrella Abigail');
		expect(opening.card.label).toBe('Primera Comunión');
	});

	it('lets opening-specific overrides replace presentation fields without changing canonical hero data', () => {
		const opening = buildOpeningViewModel({
			hero: {
				name: 'Luna Yamileth',
				secondaryName: 'Estrella Abigail',
				label: 'Primera Comunión',
				date: '2026-08-01T20:00:00.000Z',
			},
			envelope: {
				envelopeName: 'Luna y Estrella',
				cardName: 'Luna',
				cardSecondaryName: 'Estrella',
				cardLabel: 'Nuestra Primera Comunión',
				cardTagline: 'Una celebración de fe',
				guestLabel: 'Con cariño para:',
				guestNameFallback: 'Familia invitada',
			},
		});

		expect(opening.envelope.name).toBe('Luna y Estrella');
		expect(opening.card).toMatchObject({
			primaryName: 'Luna',
			secondaryName: 'Estrella',
			label: 'Nuestra Primera Comunión',
			tagline: 'Una celebración de fe',
			guestLabel: 'Con cariño para:',
			guestName: 'Familia invitada',
		});
	});

	it('prefers the route guest name over the generic preview fallback', () => {
		const opening = buildOpeningViewModel({
			hero: {
				name: 'Luna Yamileth',
				label: 'Primera Comunión',
				date: '2026-08-01T20:00:00.000Z',
			},
			envelope: { guestNameFallback: 'Familia invitada' },
			guestName: 'María García',
		});

		expect(opening.card.guestName).toBe('María García');
	});
});
