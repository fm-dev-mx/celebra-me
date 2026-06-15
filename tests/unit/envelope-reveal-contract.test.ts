import { buildRevealCard } from '@/lib/invitation/reveal-card';

describe('buildRevealCard', () => {
	it('builds the canonical reveal card data with defaults', () => {
		expect(
			buildRevealCard({
				name: 'Ximena',
				date: '2026-04-25',
			}),
		).toEqual({
			label: 'Invitación',
			name: 'Ximena',
			date: '25 · ABR · 2026',
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
