import {
	resolveGalleryLayoutVariant,
	resolveGalleryVisualVariant,
	resolveGiftsStructuralVariant,
	resolveHeroStructuralVariant,
	resolvePersonalizedAccessStructuralVariant,
	resolveRsvpStructuralVariant,
	resolveThankYouStructuralVariant,
} from '@/lib/invitation/structural-variants';

describe('section structural variant contracts', () => {
	it('gives explicit section configuration precedence over theme compatibility aliases', () => {
		expect(resolveHeroStructuralVariant('standard', 'editorial-magazine')).toBe('standard');
		expect(resolveThankYouStructuralVariant('standard', 'sacred-keepsake')).toBe('standard');
		expect(resolveGiftsStructuralVariant('standard', 'editorial-magazine')).toBe('standard');
		expect(resolveRsvpStructuralVariant('standard', 'editorial-magazine')).toBe('standard');
		expect(resolvePersonalizedAccessStructuralVariant('ornamented', 'editorial-magazine')).toBe(
			'ornamented',
		);
	});

	it('maps established legacy theme branches to bounded structural identifiers', () => {
		expect(resolveHeroStructuralVariant(undefined, 'editorial-magazine')).toBe(
			'editorial-cover',
		);
		expect(resolveThankYouStructuralVariant(undefined, 'sacred-keepsake')).toBe(
			'full-bleed-photo',
		);
		expect(resolveThankYouStructuralVariant(undefined, 'celestial-blue')).toBe(
			'editorial-back-cover',
		);
		expect(resolveGiftsStructuralVariant(undefined, 'editorial-magazine')).toBe(
			'editorial-catalog',
		);
		expect(resolveRsvpStructuralVariant(undefined, 'editorial-magazine')).toBe(
			'editorial-press-pass',
		);
		expect(resolvePersonalizedAccessStructuralVariant(undefined, 'editorial-magazine')).toBe(
			'editorial-pass',
		);
	});

	it('maps gallery legacy names to the documented layout-role contract', () => {
		expect(resolveGalleryLayoutVariant(undefined, 'editorial-magazine', 'jewelry-box')).toBe(
			'magazine-spread',
		);
		expect(resolveGalleryLayoutVariant(undefined, 'celestial-blue', 'jewelry-box')).toBe(
			'index-choreography',
		);
		expect(resolveGalleryLayoutVariant(undefined, 'single', 'jewelry-box')).toBe(
			'single-keepsake',
		);
		expect(
			resolveGalleryLayoutVariant(undefined, 'jewelry-box-wedding', 'jewelry-box-wedding'),
		).toBe('uniform-grid');
		expect(
			resolveGalleryLayoutVariant('uniform-grid', 'editorial-magazine', 'jewelry-box'),
		).toBe('uniform-grid');
	});

	it('keeps the single-keepsake visual skin compatible with the single alias', () => {
		expect(resolveGalleryVisualVariant('single-keepsake', 'jewelry-box-wedding')).toBe(
			'single',
		);
	});
});
