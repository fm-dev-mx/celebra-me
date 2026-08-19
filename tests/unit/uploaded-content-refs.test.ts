import { describe, expect, it } from '@jest/globals';
import {
	collectUploadedAssetIds,
	collectUploadedContentRefs,
} from '@/lib/invitation-preparation/uploaded-content-refs';

describe('collectUploadedContentRefs', () => {
	it('records uploaded refs with publication path strings', () => {
		const refs = collectUploadedContentRefs({
			hero: {
				backgroundImage: { type: 'uploaded', assetId: 'desktop-1' },
				backgroundImageMobile: { type: 'uploaded', assetId: 'mobile-1' },
			},
			gallery: {
				items: [{ image: { type: 'uploaded', assetId: 'gallery-1' } }],
			},
			interludes: [{ image: { type: 'uploaded', assetId: 'interlude-1' } }],
		});

		expect(refs).toEqual([
			{ path: 'hero.backgroundImage', assetId: 'desktop-1' },
			{ path: 'hero.backgroundImageMobile', assetId: 'mobile-1' },
			{ path: 'gallery.items[0].image', assetId: 'gallery-1' },
			{ path: 'interludes[0].image', assetId: 'interlude-1' },
		]);
		expect([
			...collectUploadedAssetIds({
				hero: { backgroundImage: { type: 'uploaded', assetId: 'desktop-1' } },
			}),
		]).toEqual(['desktop-1']);
	});
});
