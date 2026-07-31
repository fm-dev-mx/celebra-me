import {
	assertSupportedGalleryPresentation,
	resolveItineraryPresentation,
	resolveLocationShowFlourishes,
	resolvePortraitEnabled,
} from '@/lib/invitation/presentation-options';
import { gallerySchema } from '@/lib/intake/schemas/shared-content.schema';

describe('invitation presentation contract', () => {
	it('resolves the structural presentation couplings from section content', () => {
		expect(resolveLocationShowFlourishes({ showFlourishes: false })).toBe(false);
		expect(resolveItineraryPresentation({ behavior: 'timeline-paper' })).toBe('timeline-paper');
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
