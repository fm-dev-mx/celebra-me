import fs from 'node:fs';
import path from 'node:path';
import {
	GALLERY_LAYOUT_VARIANTS,
	GIFTS_STRUCTURAL_VARIANTS,
	HERO_STRUCTURAL_VARIANTS,
	PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS,
	RSVP_STRUCTURAL_VARIANTS,
	THANK_YOU_STRUCTURAL_VARIANTS,
} from '@/lib/invitation/structural-variants';
import { listLocalRenderCorpus } from '../../scripts/provision/local-render-corpus/registry.ts';

const read = (relativePath: string) =>
	fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('canonical variant governance', () => {
	it('documents every canonical structural identifier and the known profile boundary', () => {
		const inventory = read('docs/domains/theme/variant-system.md');
		const galleryContract = read('docs/domains/theme/gallery-variants.md');

		for (const identifier of [
			...HERO_STRUCTURAL_VARIANTS,
			...THANK_YOU_STRUCTURAL_VARIANTS,
			...GIFTS_STRUCTURAL_VARIANTS,
			...RSVP_STRUCTURAL_VARIANTS,
			...PERSONALIZED_ACCESS_STRUCTURAL_VARIANTS,
			...GALLERY_LAYOUT_VARIANTS,
		]) {
			expect(inventory).toContain(identifier);
		}

		expect(inventory).toContain('Abril');
		expect(inventory).toContain('jewelry-box-wedding');
		expect(galleryContract).toContain('unresolved invitation-specific extension');
	});

	it('keeps temporary parity checkouts out of Jest configuration', () => {
		expect(read('jest.config.cjs')).not.toContain('.tmp/');
	});

	it('keeps canonical structural resolution invitation-agnostic', () => {
		const resolver = read('src/lib/invitation/structural-variants.ts');
		for (const entry of listLocalRenderCorpus()) {
			expect(resolver).not.toContain(entry.slug);
		}
		expect(resolver).not.toMatch(/eventType|visualProfileId|eventSlug/);
	});

	it('keeps legacy normalization in adapters, not section renderers', () => {
		for (const renderer of [
			'src/components/invitation/Hero.astro',
			'src/components/invitation/EventLocation.astro',
			'src/components/invitation/Gifts.astro',
			'src/components/invitation/ThankYou.astro',
		]) {
			const source = read(renderer);
			expect(source).not.toMatch(/resolve[A-Z][A-Za-z]+StructuralVariant/);
		}
	});

	it('keeps the P1 audit and compatibility owners discoverable', () => {
		const report = read('docs/archive/reports/render-parity-ownership-audit-2026-08-10.md');
		expect(report).toContain('luna-y-estrella');
		expect(report).toContain('leah-lexa');
		expect(report).toContain('Xareni');
		expect(report).toContain('P2');
	});
});
