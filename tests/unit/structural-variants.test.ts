import {
	resolveFamilyStructuralVariant,
	resolveGalleryLayoutVariant,
	resolveGalleryVisualVariant,
	resolveGiftsStructuralVariant,
	resolveHeroStructuralVariant,
	resolveLocationStructuralVariant,
	resolvePersonalizedAccessStructuralVariant,
	resolveRsvpStructuralVariant,
	resolveThankYouStructuralVariant,
} from '@/lib/invitation/structural-variants';

describe('section structural variant contracts', () => {
	it('gives explicit section configuration precedence over defaults', () => {
		expect(resolveHeroStructuralVariant('standard')).toBe('standard');
		expect(resolveThankYouStructuralVariant('standard')).toBe('standard');
		expect(resolveGiftsStructuralVariant('standard')).toBe('standard');
		expect(resolveRsvpStructuralVariant('standard')).toBe('standard');
		expect(resolvePersonalizedAccessStructuralVariant('ornamented')).toBe('ornamented');
		expect(resolveFamilyStructuralVariant('split-groups')).toBe('split-groups');
		expect(resolveLocationStructuralVariant('split-map')).toBe('split-map');
	});

	it('keeps explicit structural selections independent from active theme contract', () => {
		expect(resolveHeroStructuralVariant('editorial-cover')).toBe('editorial-cover');
		expect(resolveHeroStructuralVariant('split-cover')).toBe('split-cover');
		expect(resolveThankYouStructuralVariant('full-bleed-photo')).toBe('full-bleed-photo');
		expect(resolveGiftsStructuralVariant('editorial-catalog')).toBe('editorial-catalog');
		expect(resolveRsvpStructuralVariant('editorial-press-pass')).toBe('editorial-press-pass');
		expect(resolvePersonalizedAccessStructuralVariant('editorial-pass')).toBe(
			'editorial-pass',
		);
		expect(resolveGalleryLayoutVariant('magazine-spread')).toBe('magazine-spread');
		expect(resolveFamilyStructuralVariant('split-groups')).toBe('split-groups');
		expect(resolveLocationStructuralVariant('split-map')).toBe('split-map');
	});

	it('defaults omitted or invalid selectors to the canonical standard path', () => {
		expect(resolveHeroStructuralVariant('not-a-variant')).toBe('standard');
		expect(resolveHeroStructuralVariant(undefined)).toBe('standard');
		expect(resolveThankYouStructuralVariant(undefined)).toBe('standard');
		expect(resolveGiftsStructuralVariant(undefined)).toBe('standard');
		expect(resolveRsvpStructuralVariant(undefined)).toBe('standard');
		expect(resolvePersonalizedAccessStructuralVariant(undefined)).toBe('standard');
		expect(resolveGalleryLayoutVariant('not-a-variant')).toBe('uniform-grid');
		expect(resolveFamilyStructuralVariant(undefined)).toBe('standard');
		expect(resolveFamilyStructuralVariant('not-a-variant')).toBe('standard');
		expect(resolveLocationStructuralVariant(undefined)).toBe('standard');
		expect(resolveLocationStructuralVariant('not-a-variant')).toBe('standard');
	});

	it('keeps the single → single-keepsake gallery alias and ignores theme-named layout inference', () => {
		expect(resolveGalleryLayoutVariant(undefined, 'editorial-magazine')).toBe('uniform-grid');
		expect(resolveGalleryLayoutVariant(undefined, 'celestial-blue')).toBe('uniform-grid');
		expect(resolveGalleryLayoutVariant(undefined, 'single')).toBe('single-keepsake');
		expect(resolveGalleryLayoutVariant('single')).toBe('single-keepsake');
		expect(resolveGalleryLayoutVariant(undefined, 'jewelry-box-wedding')).toBe('uniform-grid');
		expect(resolveGalleryLayoutVariant('uniform-grid', 'editorial-magazine')).toBe(
			'uniform-grid',
		);
		expect(resolveGalleryLayoutVariant('index-choreography', 'celestial-blue')).toBe(
			'index-choreography',
		);
	});

	it('keeps the single-keepsake visual skin compatible with the single alias', () => {
		expect(resolveGalleryVisualVariant('single-keepsake', 'jewelry-box-wedding')).toBe(
			'single',
		);
	});
});
