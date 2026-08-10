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
});
