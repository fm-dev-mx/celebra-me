import { buildRevealCard } from '@/lib/invitation/reveal-card';

describe('buildRevealCard', () => {
	it('builds the canonical reveal card data with defaults', () => {
		expect(
			buildRevealCard({
				name: 'Ximena',
				date: '2026-04-25',
				city: 'Monterrey',
			}),
		).toEqual({
			documentLabel: 'Invitación',
			name: 'Ximena',
			details: '25 abr 2026 • Monterrey',
			guestName: undefined,
			sealIcon: 'monogram',
			sealInitials: undefined,
			venueName: undefined,
		});
	});

	it('passes through venueName and sealInitials when provided', () => {
		const card = buildRevealCard({
			name: 'Ximena',
			date: '2026-04-25',
			city: 'Monterrey',
			venueName: 'Hacienda San Agustín',
			sealInitials: 'X·V',
		});
		expect(card.venueName).toBe('Hacienda San Agustín');
		expect(card.sealInitials).toBe('X·V');
	});
});
