import { envelopeSchema } from '@/lib/schemas/content/envelope.schema';
import {
	buildRevealCard,
	SEAL_ICON_MAP,
	type EnvelopeSealIcon,
} from '@/lib/invitation/reveal-card';

describe('EnvelopeReveal content contract', () => {
	it('accepts every supported seal icon with a rendered icon mapping', () => {
		for (const sealIcon of Object.keys(SEAL_ICON_MAP) as EnvelopeSealIcon[]) {
			const parsed = envelopeSchema.safeParse({
				sealStyle: 'wax',
				sealIcon,
			});

			expect(parsed.success).toBe(true);
			expect(SEAL_ICON_MAP[sealIcon]).toEqual(expect.any(String));
		}
	});

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
			details: '25 de abril de 2026 • Monterrey',
			guestName: undefined,
			sealIcon: 'monogram',
		});
	});
});
