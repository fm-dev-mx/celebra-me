import { oliviaAntonioInvitation } from '../../scripts/provision/invitations/olivia-y-antonio';
import { buildSemanticAssetMap } from '../../scripts/provision/normalized-invitation-release';
import { heroSchema } from '@/lib/schemas/content/hero.schema';
import { familySchema } from '@/lib/schemas/content/family.schema';
import { locationSchema } from '@/lib/schemas/content/location.schema';
import { familyDraftSchema } from '@/lib/intake/schemas/family-draft.schema';
import { formatHeroTime } from '@/lib/invitation/hero-presentation';
import { groupGodparentsByRole } from '@/lib/invitation/family-presentation';

const hero = {
	name: 'Olivia',
	date: '2026-12-19T01:00:00.000Z',
	backgroundImage: 'hero',
	variant: 'standard',
};

describe('hero.presentation.timeFormat', () => {
	it('accepts 12h and 24h and rejects other clocks', () => {
		for (const timeFormat of ['12h', '24h']) {
			expect(heroSchema.safeParse({ ...hero, presentation: { timeFormat } }).success).toBe(
				true,
			);
		}
		expect(
			heroSchema.safeParse({ ...hero, presentation: { timeFormat: 'ampm' } }).success,
		).toBe(false);
	});

	it('writes the 12h clock the Spanish way and keeps 24h as written', () => {
		expect(formatHeroTime('19:00', '12h')).toBe('7:00 p. m.');
		expect(formatHeroTime('19:00', '24h')).toBe('19:00');
		expect(formatHeroTime('19:00', undefined)).toBe('19:00');
	});
});

describe('family.godparentsLayout', () => {
	const family = { variant: 'asymmetric-groups', parents: { father: 'Padre', mother: 'Madre' } };

	it('accepts by-role in the content and draft schemas only', () => {
		expect(familySchema.safeParse({ ...family, godparentsLayout: 'by-role' }).success).toBe(
			true,
		);
		expect(familySchema.safeParse({ ...family, godparentsLayout: 'grid' }).success).toBe(false);
		expect(familyDraftSchema.safeParse({ godparentsLayout: 'by-role' }).success).toBe(true);
	});

	it('groups godparents by role in first-appearance order', () => {
		expect(
			groupGodparentsByRole([
				{ name: 'Flor', role: 'Velación' },
				{ name: 'Marisela', role: 'Lazo' },
				{ name: 'Manuel', role: 'Velación', deceased: true },
				{ name: 'Sin rol' },
			]),
		).toEqual([
			{ role: 'Velación', members: [{ name: 'Flor' }, { name: 'Manuel', deceased: true }] },
			{ role: 'Lazo', members: [{ name: 'Marisela' }] },
			{ role: '', members: [{ name: 'Sin rol' }] },
		]);
	});
});

describe('location.presentationOptions.venueCard', () => {
	const published = oliviaAntonioInvitation.buildPublishedContent(
		buildSemanticAssetMap(oliviaAntonioInvitation),
	);
	const location = published.location as {
		presentationOptions?: { venueCard?: string };
	};

	it('accepts the compact card on stacked venue plates', () => {
		expect(location.presentationOptions?.venueCard).toBe('compact');
		expect(locationSchema.safeParse(location).success).toBe(true);
	});

	it('rejects the compact card on any other variant', () => {
		const result = locationSchema.safeParse({ ...location, variant: 'split-map' });

		expect(result.success).toBe(false);
		expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain(
			'presentationOptions.venueCard',
		);
	});
});
