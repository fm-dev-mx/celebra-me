const mockFindArchived = jest.fn();
const mockFindAssetById = jest.fn();
const mockRestoreAssetRepo = jest.fn();
const mockGetPublicUrl = jest.fn();

jest.mock('@/lib/intake/repositories/asset.repository', () => ({
	findArchivedAssetsByInvitationId: mockFindArchived,
	findAssetById: mockFindAssetById,
	restoreAsset: mockRestoreAssetRepo,
}));

jest.mock('@/lib/intake/storage', () => ({
	getPublicUrl: mockGetPublicUrl,
	DEFAULT_BUCKET: 'invitation-assets',
	uploadToStorage: jest.fn(),
}));

jest.mock('@/lib/intake/services/demo-asset.service', () => ({
	getDemoPresetAssets: jest.fn().mockReturnValue([]),
}));

jest.mock('@/lib/intake/services/asset-usage.service', () => ({
	collectAssetUsagesByInvitation: jest.fn().mockResolvedValue([]),
	collectAssetUsage: jest.fn(),
}));

import { listAssets, restoreAsset } from '@/lib/intake/services/asset.service';

beforeEach(() => {
	jest.clearAllMocks();
});

describe('listAssets with archive filter', () => {
	it('returns archived assets when filter is archived', async () => {
		mockFindArchived.mockResolvedValue([
			{
				id: 'archived-1',
				invitationId: 'inv-1',
				displayName: 'Foto archivada',
				defaultAltText: undefined,
				bucket: 'invitation-assets',
				storagePath: 'path/img.webp',
				mimeType: 'image/webp',
				width: undefined,
				height: undefined,
				fileSize: undefined,
				createdAt: '',
				updatedAt: '',
				deletedAt: '2026-06-01T00:00:00.000Z',
			},
		]);
		mockGetPublicUrl.mockReturnValue('https://cdn.test/img.webp');

		const result = await listAssets('inv-1', undefined, 'archived');

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			id: 'archived-1',
			displayName: 'Foto archivada',
			isDemo: false,
		});
	});

	it('does not return demo assets in archived filter', async () => {
		mockFindArchived.mockResolvedValue([]);

		const result = await listAssets('inv-1', 'demo-xv-test', 'archived');

		expect(result).toHaveLength(0);
	});
});

describe('restoreAsset', () => {
	const ASSET_ID = 'test-asset-id';
	const INVITATION_ID = 'inv-1';

	it('throws when asset not found', async () => {
		mockFindAssetById.mockResolvedValue(null);

		await expect(restoreAsset(ASSET_ID, INVITATION_ID)).rejects.toThrow(
			'No se encontró el recurso solicitado.',
		);
	});

	it('throws when invitationId does not match', async () => {
		mockFindAssetById.mockResolvedValue({
			id: ASSET_ID,
			invitationId: 'other-inv',
			deletedAt: '2026-06-01T00:00:00.000Z',
		});

		await expect(restoreAsset(ASSET_ID, INVITATION_ID)).rejects.toThrow(
			'No se encontró el recurso solicitado.',
		);
	});

	it('throws when asset is not archived', async () => {
		mockFindAssetById.mockResolvedValue({
			id: ASSET_ID,
			invitationId: INVITATION_ID,
			deletedAt: undefined,
		});

		await expect(restoreAsset(ASSET_ID, INVITATION_ID)).rejects.toThrow(
			'El recurso no está archivado.',
		);
	});

	it('restores an archived asset', async () => {
		mockFindAssetById.mockResolvedValue({
			id: ASSET_ID,
			invitationId: INVITATION_ID,
			deletedAt: '2026-06-01T00:00:00.000Z',
		});
		mockRestoreAssetRepo.mockResolvedValue({
			id: ASSET_ID,
			invitationId: INVITATION_ID,
			displayName: 'Foto restaurada',
			deletedAt: undefined,
		});

		const result = await restoreAsset(ASSET_ID, INVITATION_ID);

		expect(mockRestoreAssetRepo).toHaveBeenCalledWith(ASSET_ID);
		expect(result.deletedAt).toBeUndefined();
	});
});
