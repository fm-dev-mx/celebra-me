import { getLayoutClass } from '@/lib/components/gallery/getLayoutClass';

describe('getLayoutClass', () => {
	it('uses the standard frame for the reusable single-image gallery variant', () => {
		expect(getLayoutClass(0, 'single')).toBe('gallery-grid__item--standard');
		expect(getLayoutClass(1, 'single')).toBe('gallery-grid__item--standard');
	});

	it('falls back to standard for unknown variant', () => {
		expect(getLayoutClass(0, 'nonexistent')).toBe('gallery-grid__item--standard');
	});

	it('falls back to standard when variant is undefined', () => {
		expect(getLayoutClass(0, undefined)).toBe('gallery-grid__item--standard');
		expect(getLayoutClass(3, undefined)).toBe('gallery-grid__item--standard');
	});

	it('still produces correct layout classes for known variants', () => {
		expect(getLayoutClass(0, 'jewelry-box')).toBe('gallery-grid__item--feature');
		expect(getLayoutClass(1, 'jewelry-box')).toBe('gallery-grid__item--standard');
	});

	it('supports behavior-named layout variants independently of theme names', () => {
		expect(getLayoutClass(0, 'magazine-spread')).toBe('gallery-grid__item--feature');
		expect(getLayoutClass(3, 'magazine-spread')).toBe('gallery-grid__item--wide');
		expect(getLayoutClass(0, 'index-choreography')).toBe('gallery-grid__item--feature');
		expect(getLayoutClass(0, 'uniform-grid')).toBe('gallery-grid__item--standard');
	});

	it('honors an explicit layoutRole over variant index strategies', () => {
		expect(getLayoutClass(3, 'premiere-floral', 'feature')).toBe('gallery-grid__item--feature');
	});
});
