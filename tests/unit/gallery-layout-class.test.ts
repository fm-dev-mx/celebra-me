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
});
