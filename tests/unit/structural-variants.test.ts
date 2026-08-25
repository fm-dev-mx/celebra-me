import fs from 'node:fs';
import path from 'node:path';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import {
	CANONICAL_VARIANT_REGISTRY,
	CANONICAL_VARIANT_CUTOVER_MANIFEST,
} from '@/lib/invitation/section-variants';

const baseInput = {
	eventType: 'xv',
	title: 'Variant contract fixture',
	isDemo: true,
	theme: { preset: 'jewelry-box' },
	sectionOrder: ['family', 'countdown', 'gallery', 'rsvp'],
	composition: { intersections: {} },
	hero: {
		name: 'Fixture', date: '2027-01-01T18:00:00.000Z', backgroundImage: '/fixture.webp', variant: 'standard',
	},
	family: { variant: 'standard', parents: { father: 'Padre', mother: 'Madre' } },
	countdown: { title: 'Cuenta', variant: 'standard' },
	gallery: { variant: 'uniform-grid', items: [{ image: '/fixture.webp' }] },
	rsvp: { variant: 'standard', personalizedAccess: { variant: 'standard' } },
};

describe('canonical section variant contracts', () => {
	it('keeps the complete closed vocabulary in one registry', () => {
		expect(CANONICAL_VARIANT_REGISTRY).toHaveLength(39);
		expect(CANONICAL_VARIANT_CUTOVER_MANIFEST).toHaveLength(29);
		expect(CANONICAL_VARIANT_REGISTRY.filter((entry) => entry.default)).toHaveLength(10);
		expect(CANONICAL_VARIANT_REGISTRY.map((entry) => `${entry.section}.${entry.variant}`)).toEqual(
			expect.arrayContaining(['family.split-groups', 'gallery.editorial-mosaic', 'thankYou.full-bleed-photo']),
		);
	});

	it('keeps the Goal 2 handoff manifest derived from every non-default entry', () => {
		const manifest = fs.readFileSync(
			path.join(process.cwd(), 'docs/domains/theme/variant-cutover-manifest.md'),
			'utf8',
		);

		for (const entry of CANONICAL_VARIANT_CUTOVER_MANIFEST) {
			expect(manifest).toContain(`\`${entry.section}.${entry.variant}\``);
		}
	});

	it('rejects legacy aliases and unknown canonical variants', () => {
		const legacy = eventContentSchema.safeParse({
			...baseInput,
			hero: { ...baseInput.hero, variant: 'split-cover', structuralVariant: 'standard' },
		});
		const unknown = eventContentSchema.safeParse({
			...baseInput,
			hero: { ...baseInput.hero, variant: 'not-a-variant' },
		});

		expect(legacy.success).toBe(false);
		expect(unknown.success).toBe(false);
	});

	it('rejects incompatible family and location prerequisites', () => {
		const familyResult = eventContentSchema.safeParse({
			...baseInput,
			family: { variant: 'split-groups', groups: [{ title: 'Solo', items: [{ name: 'Persona' }] }] },
		});
		const locationResult = eventContentSchema.safeParse({
			...baseInput,
			location: {
				variant: 'split-map',
				ceremony: {
					venueEvent: 'Ceremonia', venueName: 'Lugar', address: 'Dirección',
					date: '2027-01-01', time: '18:00',
				},
			},
		});

		expect(familyResult.success).toBe(false);
		expect(locationResult.success).toBe(false);
	});

	it('enforces single-keepsake cardinality', () => {
		const empty = eventContentSchema.safeParse({
			...baseInput,
			gallery: { variant: 'single-keepsake', items: [] },
		});
		const exact = eventContentSchema.safeParse({
			...baseInput,
			gallery: { variant: 'single-keepsake', items: [{ image: '/fixture.webp' }] },
		});

		expect(empty.success).toBe(false);
		expect(exact.success).toBe(true);
	});
});
