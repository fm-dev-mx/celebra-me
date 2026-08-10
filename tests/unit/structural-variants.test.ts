import {
	resolveGalleryLayoutVariant,
	resolveGalleryVisualVariant,
	resolveGiftsStructuralVariant,
	resolveHeroStructuralVariant,
	resolvePersonalizedAccessStructuralVariant,
	resolveRsvpStructuralVariant,
	resolveThankYouStructuralVariant,
} from '@/lib/invitation/structural-variants';
import { THEME_PRESETS } from '@/lib/theme/theme-contract';

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

	it('keeps explicit structural selections independent from the active theme', () => {
		for (const theme of THEME_PRESETS) {
			expect(resolveHeroStructuralVariant('editorial-cover', theme)).toBe('editorial-cover');
			expect(resolveThankYouStructuralVariant('full-bleed-photo', theme)).toBe(
				'full-bleed-photo',
			);
			expect(resolveGiftsStructuralVariant('editorial-catalog', theme)).toBe(
				'editorial-catalog',
			);
			expect(resolveRsvpStructuralVariant('editorial-press-pass', theme)).toBe(
				'editorial-press-pass',
			);
			expect(resolvePersonalizedAccessStructuralVariant('editorial-pass', theme)).toBe(
				'editorial-pass',
			);
			expect(resolveGalleryLayoutVariant('magazine-spread', undefined, theme)).toBe(
				'magazine-spread',
			);
		}
	});

	it('keeps invalid or omitted selectors on the documented compatibility path', () => {
		expect(resolveHeroStructuralVariant('not-a-variant', 'editorial-magazine')).toBe(
			'editorial-cover',
		);
		expect(resolveHeroStructuralVariant('not-a-variant', 'jewelry-box')).toBe('standard');
		expect(resolveGalleryLayoutVariant('not-a-variant', undefined, 'celestial-blue')).toBe(
			'index-choreography',
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
