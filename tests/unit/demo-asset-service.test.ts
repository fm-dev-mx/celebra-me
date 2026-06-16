const mockIsValidEvent = jest.fn();
const mockGetEventAsset = jest.fn();

jest.mock('@/lib/assets/asset-registry', () => ({
	isValidEvent: mockIsValidEvent,
	getEventAsset: mockGetEventAsset,
}));

import { getDemoPresetAssets } from '@/lib/intake/services/demo-asset.service';

beforeEach(() => {
	jest.clearAllMocks();
});

describe('getDemoPresetAssets', () => {
	it('returns empty array when slug is not valid', () => {
		mockIsValidEvent.mockReturnValue(false);
		const result = getDemoPresetAssets('nonexistent');
		expect(result).toEqual([]);
		expect(mockIsValidEvent).toHaveBeenCalledWith('nonexistent');
	});

	it('returns entries with correct keys, data, and labels for matching assets', () => {
		mockIsValidEvent.mockReturnValue(true);
		mockGetEventAsset.mockImplementation((_slug: string, key: string) => {
			if (key === 'hero') return { src: '/hero.webp', width: 1080, height: 1920 } as any;
			if (key === 'portrait')
				return { src: '/portrait.webp', width: 600, height: 800 } as any;
			if (key === 'interlude02')
				return { src: '/interlude-02.webp', width: 1080, height: 1920 } as any;
			return undefined;
		});

		const result = getDemoPresetAssets('demo-xv-enchanted-rose');

		expect(result).toHaveLength(3);
		expect(result[0]).toMatchObject({
			key: 'hero',
			displayName: 'Portada',
			src: '/hero.webp',
			width: 1080,
			height: 1920,
		});
		expect(result[1]).toMatchObject({
			key: 'portrait',
			displayName: 'Retrato',
			src: '/portrait.webp',
			width: 600,
			height: 800,
		});
		expect(result[2]).toMatchObject({
			key: 'interlude02',
			displayName: 'Interludio 2',
			src: '/interlude-02.webp',
			width: 1080,
			height: 1920,
		});
	});

	it('roundtrips: each returned entry key matches the key passed to getEventAsset', () => {
		mockIsValidEvent.mockReturnValue(true);
		mockGetEventAsset.mockReturnValue({ src: '/asset.webp', width: 100, height: 100 });

		const result = getDemoPresetAssets('demo-xv-enchanted-rose');

		for (const entry of result) {
			expect(mockGetEventAsset).toHaveBeenCalledWith('demo-xv-enchanted-rose', entry.key);
		}
	});

	it('returns empty array when no assets are registered for the slug', () => {
		mockIsValidEvent.mockReturnValue(true);
		mockGetEventAsset.mockReturnValue(undefined);

		const result = getDemoPresetAssets('demo-xv-enchanted-rose');
		expect(result).toEqual([]);
	});
});
