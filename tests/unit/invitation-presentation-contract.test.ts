import { gallerySchema } from '@/lib/intake/schemas/shared-content.schema';
import { resolveLocationShowFlourishes as resolveCanonicalLocationShowFlourishes } from '@/lib/invitation/location-presentation';
import { ITINERARY_VARIANTS } from '@/lib/invitation/section-variants';
import {
	assertSupportedGalleryPresentation,
	resolveLocationShowFlourishes,
	resolveLocationShowNavigationButtons,
	resolvePortraitEnabled,
} from '@/lib/invitation/presentation-options';

describe('invitation presentation contract', () => {
	it('resolves the structural presentation couplings from section content', () => {
		expect(resolveLocationShowFlourishes({ showFlourishes: false })).toBe(false);
		expect(resolveCanonicalLocationShowFlourishes(undefined, 'split-map')).toBe(false);
		expect(resolveCanonicalLocationShowFlourishes(undefined, 'standard')).toBe(true);
		expect(resolveLocationShowNavigationButtons({ showNavigationButtons: false }, true)).toBe(
			false,
		);
		expect(resolveLocationShowNavigationButtons(undefined, false)).toBe(false);
		expect(ITINERARY_VARIANTS).toEqual(['standard', 'timeline-paper', 'editorial-ledger', 'editorial-program']);
		expect(resolvePortraitEnabled({ portraitEnabled: true }, false)).toBe(true);
		expect(resolvePortraitEnabled(undefined, true)).toBe(true);
		expect(() =>
			assertSupportedGalleryPresentation('pet-keepsake', [{ layoutRole: 'feature' }]),
		).toThrow('does not support per-item layout roles');
	});

	it('rejects unsupported gallery presentation combinations at draft validation', () => {
		expect(
			gallerySchema.safeParse({
				presentation: 'pet-keepsake',
				items: [
					{
						image: 'hero',
						layoutRole: 'feature',
					},
				],
			}).success,
		).toBe(false);
	});
});
