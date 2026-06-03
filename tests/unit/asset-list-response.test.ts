const mockFindAssets = jest.fn();
const mockCollectUsages = jest.fn();
const mockGetDemoAssets = jest.fn();
const mockGetPublicUrl = jest.fn();

jest.mock('@/lib/intake/repositories/asset.repository', () => ({
	findAssetsByInvitationId: mockFindAssets,
}));

jest.mock('@/lib/intake/services/asset-usage.service', () => ({
	collectAssetUsagesByInvitation: mockCollectUsages,
}));

jest.mock('@/lib/intake/services/demo-asset.service', () => ({
	getDemoPresetAssets: mockGetDemoAssets,
}));

jest.mock('@/lib/intake/storage', () => ({
	getPublicUrl: mockGetPublicUrl,
	DEFAULT_BUCKET: 'invitation-assets',
	uploadToStorage: jest.fn(),
}));

import { listAssets } from '@/lib/intake/services/asset.service';

beforeEach(() => {
	jest.clearAllMocks();
});

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001';

describe('listAssets', () => {
	it('returns uploaded assets with usage and src', async () => {
		mockFindAssets.mockResolvedValue([
			{
				id: VALID_UUID,
				invitationId: 'inv-1',
				displayName: 'Foto',
				defaultAltText: undefined,
				bucket: 'invitation-assets',
				storagePath: 'path/to/foto.webp',
				mimeType: 'image/webp',
				width: 800,
				height: 600,
				fileSize: 1000,
				createdAt: '',
				updatedAt: '',
			},
		]);
		mockCollectUsages.mockResolvedValue([
			{
				assetId: VALID_UUID,
				usedInDraft: true,
				usedInPublished: false,
				draftRefs: [{ section: 'hero', path: 'hero.backgroundImage' }],
				publishedRefs: [],
			},
		]);
		mockGetPublicUrl.mockReturnValue('https://cdn.test/foto.webp');
		mockGetDemoAssets.mockReturnValue([]);

		const result = await listAssets('inv-1', 'demo-xv-test');

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			id: VALID_UUID,
			displayName: 'Foto',
			src: 'https://cdn.test/foto.webp',
			isDemo: false,
			usage: {
				usedInDraft: true,
				usedInPublished: false,
				draftSectionRefs: ['hero.backgroundImage'],
				publishedSectionRefs: [],
			},
		});
	});

	it('merges demo assets when previewSlug is provided', async () => {
		mockFindAssets.mockResolvedValue([]);
		mockCollectUsages.mockResolvedValue([]);
		mockGetPublicUrl.mockReturnValue('');
		mockGetDemoAssets.mockReturnValue([
			{ key: 'hero', displayName: 'Portada', src: '/hero.webp', width: 1080, height: 1920 },
		]);

		const result = await listAssets('inv-1', 'demo-xv-test');

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			id: 'demo:demo-xv-test:hero',
			displayName: 'Portada',
			src: '/hero.webp',
			isDemo: true,
			demoKey: 'hero',
		});
	});

	it('does not merge demo assets when no previewSlug', async () => {
		mockFindAssets.mockResolvedValue([]);
		mockCollectUsages.mockResolvedValue([]);
		mockGetPublicUrl.mockReturnValue('');
		mockGetDemoAssets.mockReturnValue([
			{ key: 'hero', displayName: 'Portada', src: '/hero.webp' },
		]);

		const result = await listAssets('inv-1');

		expect(result).toHaveLength(0);
		expect(mockGetDemoAssets).not.toHaveBeenCalled();
	});
});
