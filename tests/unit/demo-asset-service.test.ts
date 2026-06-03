const mockIsValidEvent = jest.fn();
const mockGetEventAsset = jest.fn();

jest.mock('@/lib/assets/asset-registry', () => ({
	isValidEvent: mockIsValidEvent,
	getEventAsset: mockGetEventAsset,
	EVENT_KEYS: ['hero', 'portrait', 'gallery01', 'gallery02'],
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

	it('returns entries for registered asset keys that exist', () => {
		mockIsValidEvent.mockReturnValue(true);
		mockGetEventAsset.mockImplementation((_slug: string, key: string) => {
			if (key === 'hero') return { src: '/hero.webp', width: 1080, height: 1920 } as any;
			if (key === 'portrait')
				return { src: '/portrait.webp', width: 600, height: 800 } as any;
			return undefined;
		});

		const result = getDemoPresetAssets('demo-xv-enchanted-rose');

		expect(result).toHaveLength(2);
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
	});

	it('returns empty array when no assets are registered for the slug', () => {
		mockIsValidEvent.mockReturnValue(true);
		mockGetEventAsset.mockReturnValue(undefined);

		const result = getDemoPresetAssets('demo-xv-enchanted-rose');
		expect(result).toEqual([]);
	});
});
