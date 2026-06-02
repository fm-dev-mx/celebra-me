import {
	getGalleryPreviewAspectRatio,
	getGalleryPreviewRole,
} from '@/lib/components/gallery/gallery-presentation';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('gallery presentation', () => {
	it('reuses public layout roles for editor previews', () => {
		expect(getGalleryPreviewRole(0, 'luxury-hacienda')).toBe('feature');
		expect(getGalleryPreviewRole(1, 'luxury-hacienda')).toBe('wide');
		expect(getGalleryPreviewRole(4, 'luxury-hacienda')).toBe('standard');
	});

	it('falls back to standard for themes without explicit layout strategies', () => {
		expect(getGalleryPreviewRole(0, 'angelic-presence')).toBe('standard');
		expect(getGalleryPreviewRole(1, 'sacred-keepsake')).toBe('standard');
		expect(getGalleryPreviewRole(2, 'editorial')).toBe('standard');
		expect(getGalleryPreviewRole(0, 'premiere-floral')).toBe('standard');
	});

	it('uses distinct mobile and desktop crop frames', () => {
		expect(getGalleryPreviewAspectRatio('feature', 'mobile')).toBe('4 / 5');
		expect(getGalleryPreviewAspectRatio('feature', 'desktop')).toBe('16 / 10');
		expect(getGalleryPreviewAspectRatio('wide', 'desktop')).toBe('4 / 3');
	});

	it('emits persisted focal points as public gallery item overrides', () => {
		const component = readFileSync(
			resolve(process.cwd(), 'src/components/invitation/PhotoGallery.astro'),
			'utf8',
		);

		expect(component).toContain('--gallery-item-focal-point');
	});
});
