import { describe, expect, it } from '@jest/globals';
import {
	IMAGE_DELIVERY_BUDGETS,
	classifyImageSectionRole,
	evaluateAggregateImageBudgets,
} from '@/lib/invitation-preparation/image-delivery-budget';

describe('invitation image delivery budgets', () => {
	it('locks section and viewport limits', () => {
		expect(IMAGE_DELIVERY_BUDGETS.hero.maxBytes).toEqual({
			mobile: 150 * 1024,
			desktop: 250 * 1024,
		});
		expect(IMAGE_DELIVERY_BUDGETS['gallery-visible'].loading).toBe('lazy');
		expect(IMAGE_DELIVERY_BUDGETS.hero.loading).toBe('eager');
	});

	it.each([
		['hero.backgroundImage', 'hero'],
		['family.featuredImage', 'portrait-family'],
		['gallery.items[0].image', 'gallery-visible'],
		['interludes[0].image', 'interlude'],
		['location.reception.image', 'venue'],
		['mapCeremony', 'raster-map'],
		['thankYou.image', 'closing'],
	] as const)('classifies %s as %s', (path, role) => {
		expect(classifyImageSectionRole(path)).toBe(role);
	});

	it('deduplicates a hero reused by Open Graph', () => {
		expect(
			evaluateAggregateImageBudgets(
				[
					{
						identity: 'hero-sha',
						role: 'hero',
						bytes: 140 * 1024,
						preLcp: true,
						initial: true,
					},
					{
						identity: 'hero-sha',
						role: 'hero',
						bytes: 140 * 1024,
						preLcp: true,
						initial: true,
					},
				],
				'mobile',
			),
		).toEqual([]);
	});

	it('reports individual and aggregate failures', () => {
		const failures = evaluateAggregateImageBudgets(
			[
				{
					identity: 'hero-a',
					role: 'hero',
					bytes: 200 * 1024,
					preLcp: true,
					initial: true,
				},
				{
					identity: 'hero-b',
					role: 'hero',
					bytes: 200 * 1024,
					preLcp: true,
					initial: true,
				},
			],
			'mobile',
		);
		expect(failures).toHaveLength(3);
		expect(failures.join('\n')).toContain('Pre-LCP');
	});
});
