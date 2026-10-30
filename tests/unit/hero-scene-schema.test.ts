import { heroSchema } from '@/lib/schemas/content/hero.schema';

const baseHero = {
	name: 'Ana',
	date: '2027-10-23T12:00:00.000Z',
	backgroundImage: { type: 'internal', key: 'hero' },
	variant: 'standard',
};

describe('hero.presentation.scene', () => {
	it('accepts the cover-approach scene on the standard cover', () => {
		const result = heroSchema.safeParse({
			...baseHero,
			presentation: { scene: 'cover-approach' },
		});
		expect(result.success).toBe(true);
	});

	it('rejects the scene on a cover that cannot play it', () => {
		const result = heroSchema.safeParse({
			...baseHero,
			variant: 'night-arch',
			presentation: { scene: 'cover-approach' },
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(['presentation', 'scene']);
	});
});
