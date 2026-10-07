import { getLayoutClass } from '@/lib/components/gallery/getLayoutClass';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';

describe('getLayoutClass', () => {
	it('falls back to standard for unknown variant', () => {
		expect(getLayoutClass(0, 'nonexistent')).toBe('gallery-grid__item--standard');
	});

	it('falls back to standard when variant is undefined', () => {
		expect(getLayoutClass(0, undefined)).toBe('gallery-grid__item--standard');
		expect(getLayoutClass(3, undefined)).toBe('gallery-grid__item--standard');
	});

	it('assigns item roles from the gallery variant', () => {
		expect(getLayoutClass(0, 'magazine-spread')).toBe('gallery-grid__item--feature');
		expect(getLayoutClass(3, 'magazine-spread')).toBe('gallery-grid__item--wide');
		expect(getLayoutClass(0, 'index-choreography')).toBe('gallery-grid__item--feature');
		expect(getLayoutClass(1, 'feature-mosaic')).toBe('gallery-grid__item--wide');
		expect(getLayoutClass(0, 'uniform-grid')).toBe('gallery-grid__item--standard');
	});

	it('never derives item roles from a theme preset name', () => {
		for (const preset of THEME_PRESETS) {
			for (const index of [0, 1, 2, 3, 5, 7]) {
				expect(getLayoutClass(index, preset)).toBe('gallery-grid__item--standard');
			}
		}
	});

	it('honors an explicit layoutRole over variant index strategies', () => {
		expect(getLayoutClass(3, 'uniform-grid', 'feature')).toBe('gallery-grid__item--feature');
	});
});
