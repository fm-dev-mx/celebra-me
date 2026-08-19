import { describe, expect, it } from '@jest/globals';
import {
	IMAGE_ROLE_WEIGHT_TARGETS,
	getImageOptimizationRoleForPath,
	getWeightTargetBytes,
} from '@/lib/invitation-preparation/image-optimization';

describe('canonical image role budgets', () => {
	it('locks the published transfer-weight SSOT', () => {
		expect(IMAGE_ROLE_WEIGHT_TARGETS).toEqual({
			'hero-desktop': { minKb: 250, maxKb: 500 },
			'hero-mobile': { minKb: 180, maxKb: 350 },
			'editorial-featured': { minKb: 150, maxKb: 300 },
			'standard-section': { minKb: 100, maxKb: 220 },
			gallery: { minKb: 80, maxKb: 180 },
			'small-card': { minKb: 40, maxKb: 100 },
			thumbnail: { minKb: 20, maxKb: 60 },
		});
		expect(getWeightTargetBytes('hero-mobile')).toBe(350 * 1024);
		expect(getWeightTargetBytes('hero-desktop')).toBe(500 * 1024);
	});

	it('maps published content paths to delivery roles', () => {
		expect(getImageOptimizationRoleForPath('hero.backgroundImageMobile')).toBe('hero-mobile');
		expect(getImageOptimizationRoleForPath('hero.backgroundImage')).toBe('hero-desktop');
		expect(getImageOptimizationRoleForPath('hero.backgroundImageDesktop')).toBe('hero-desktop');
		expect(getImageOptimizationRoleForPath('hero.portrait')).toBe('editorial-featured');
		expect(getImageOptimizationRoleForPath('family.featuredImage')).toBe('editorial-featured');
		expect(getImageOptimizationRoleForPath('thankYou.image')).toBe('editorial-featured');
		expect(getImageOptimizationRoleForPath('interludes[0].image')).toBe('editorial-featured');
		expect(getImageOptimizationRoleForPath('gallery.items[2].image')).toBe('gallery');
		expect(getImageOptimizationRoleForPath('location.reception.image')).toBe(
			'standard-section',
		);
		expect(getImageOptimizationRoleForPath('sharing.ogImage')).toBe('hero-desktop');
	});
});
