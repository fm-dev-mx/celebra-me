import {
	getGalleryPreviewAspectRatio,
	getGalleryPreviewRole,
} from '@/lib/components/gallery/gallery-presentation';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('gallery presentation', () => {
	it('reuses public layout roles for editor previews', () => {
		expect(getGalleryPreviewRole(0, 'feature-mosaic')).toBe('feature');
		expect(getGalleryPreviewRole(1, 'feature-mosaic')).toBe('wide');
		expect(getGalleryPreviewRole(4, 'feature-mosaic')).toBe('standard');
	});

	it('falls back to standard for variants without a position pattern', () => {
		expect(getGalleryPreviewRole(0, 'uniform-grid')).toBe('standard');
		expect(getGalleryPreviewRole(1, 'single-keepsake')).toBe('standard');
		expect(getGalleryPreviewRole(2, undefined)).toBe('standard');
	});

	it('uses distinct mobile, tablet, and desktop crop frames', () => {
		expect(getGalleryPreviewAspectRatio('feature', 'mobile')).toBe('4 / 5');
		expect(getGalleryPreviewAspectRatio('feature', 'tablet')).toBe('16 / 10');
		expect(getGalleryPreviewAspectRatio('feature', 'desktop')).toBe('16 / 10');
		expect(getGalleryPreviewAspectRatio('wide', 'desktop')).toBe('4 / 3');
	});

	it('prefers an explicit content aspect ratio over role defaults', () => {
		expect(getGalleryPreviewAspectRatio('feature', 'desktop', '8 / 5')).toBe('8 / 5');
		expect(getGalleryPreviewAspectRatio('feature', 'desktop')).toBe('16 / 10');
		expect(getGalleryPreviewAspectRatio('feature', 'desktop', '   ')).toBe('16 / 10');
	});

	it('emits persisted focal points as public gallery item overrides', () => {
		const component = readFileSync(
			resolve(process.cwd(), 'src/components/invitation/PhotoGallery.astro'),
			'utf8',
		);

		expect(component).toContain('--gallery-item-focal-point');
	});
});
