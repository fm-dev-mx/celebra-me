import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const galleryStyles = readFileSync(
	resolve(process.cwd(), 'src/styles/themes/sections/gallery/_single-keepsake.scss'),
	'utf8',
);
const singleVariantStart = galleryStyles.indexOf(".gallery-section[data-variant='single-keepsake']");
const singleVariantStyles = galleryStyles.slice(singleVariantStart);
const profileSources = [
	'daniela-y-martin',
	'leah-lexa',
	'victoria-y-roberto',
].map((profile) =>
	readFileSync(
		resolve(process.cwd(), `src/styles/invitation-profiles/${profile}.scss`),
		'utf8',
	),
);

describe('Gallery single cross-preset style contract', () => {
	it('keeps reusable geometry in the canonical section owner', () => {
		expect(singleVariantStart).toBeGreaterThanOrEqual(0);
		expect(singleVariantStyles).toContain('--gallery-item-aspect-ratio');
		expect(singleVariantStyles).toContain('--gallery-section-padding-block');
		expect(singleVariantStyles).toContain('writing-mode: vertical-rl');
		expect(singleVariantStyles).toContain('@include m.respond-below(md)');
		expect(singleVariantStyles).not.toMatch(
			/--color-(ice-blue|diamond-white|liquid-silver|deep-blue-graphite)(?:-rgb)?/,
		);
	});

	it('keeps profile-specific single-keepsake adjustments token-only', () => {
		for (const profileStyles of profileSources) {
			expect(profileStyles).not.toMatch(/\.gallery-section__eyebrow\s*\{|\.gallery-grid\s*\{/u);
			expect(profileStyles).not.toMatch(/\.gallery-grid__item(?:--feature)?\s*\{|\.gallery-grid__item img\s*\{/u);
			expect(profileStyles).not.toContain('--gallery-single-max-width');
		}
	});
});
