import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const galleryStyles = readFileSync(
	resolve(process.cwd(), 'src/styles/invitation/_gallery.scss'),
	'utf8',
);
const singleVariantStart = galleryStyles.indexOf(".gallery-section[data-variant='single']");
const galleryGridStart = galleryStyles.indexOf('\n.gallery-grid {', singleVariantStart);
const singleVariantStyles = galleryStyles.slice(singleVariantStart, galleryGridStart);

describe('Gallery single cross-preset style contract', () => {
	it('uses semantic palette tokens instead of Celestial Blue-only variables', () => {
		expect(singleVariantStart).toBeGreaterThanOrEqual(0);
		expect(galleryGridStart).toBeGreaterThan(singleVariantStart);
		expect(singleVariantStyles).toContain('--color-surface-soft-rgb');
		expect(singleVariantStyles).toContain('--color-surface-elevated-rgb');
		expect(singleVariantStyles).toContain('--color-text-primary-rgb');
		expect(singleVariantStyles).toContain('--color-glass-border');
		expect(singleVariantStyles).not.toMatch(
			/--color-(ice-blue|diamond-white|liquid-silver|deep-blue-graphite)(?:-rgb)?/,
		);
	});
});
