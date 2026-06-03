const mockFindAssetById = jest.fn();
const mockUpdateAsset = jest.fn();

jest.mock('@/lib/intake/repositories/asset.repository', () => ({
	findAssetById: mockFindAssetById,
	updateAsset: mockUpdateAsset,
}));

import { updateAssetMetadata } from '@/lib/intake/services/asset.service';

beforeEach(() => {
	jest.clearAllMocks();
});

describe('updateAssetMetadata', () => {
	const ASSET_ID = '550e8400-e29b-41d4-a716-446655440001';
	const INVITATION_ID = 'inv-1';

	const baseAsset = {
		id: ASSET_ID,
		invitationId: INVITATION_ID,
		displayName: 'Foto',
		defaultAltText: undefined,
		bucket: 'test',
		storagePath: 'test/path',
		mimeType: 'image/webp',
		width: undefined,
		height: undefined,
		fileSize: undefined,
		createdAt: '',
		updatedAt: '',
		deletedAt: undefined,
	};

	it('updates displayName', async () => {
		mockFindAssetById.mockResolvedValue({ ...baseAsset });
		mockUpdateAsset.mockResolvedValue({
			...baseAsset,
			displayName: 'Nuevo nombre',
		});

		const result = await updateAssetMetadata(
			ASSET_ID,
			{ displayName: 'Nuevo nombre' },
			INVITATION_ID,
		);

		expect(mockFindAssetById).toHaveBeenCalledWith(ASSET_ID);
		expect(mockUpdateAsset).toHaveBeenCalledWith(ASSET_ID, { displayName: 'Nuevo nombre' });
		expect(result.displayName).toBe('Nuevo nombre');
	});

	it('updates defaultAltText', async () => {
		mockFindAssetById.mockResolvedValue({ ...baseAsset });
		mockUpdateAsset.mockResolvedValue({
			...baseAsset,
			defaultAltText: 'Texto alternativo',
		});

		const result = await updateAssetMetadata(
			ASSET_ID,
			{ defaultAltText: 'Texto alternativo' },
			INVITATION_ID,
		);

		expect(mockUpdateAsset).toHaveBeenCalledWith(ASSET_ID, {
			defaultAltText: 'Texto alternativo',
		});
		expect(result.defaultAltText).toBe('Texto alternativo');
	});

	it('updates both fields simultaneously', async () => {
		mockFindAssetById.mockResolvedValue({ ...baseAsset });
		mockUpdateAsset.mockResolvedValue({
			...baseAsset,
			displayName: 'Nuevo nombre',
			defaultAltText: 'Nuevo alt',
		});

		const result = await updateAssetMetadata(
			ASSET_ID,
			{
				displayName: 'Nuevo nombre',
				defaultAltText: 'Nuevo alt',
			},
			INVITATION_ID,
		);

		expect(mockUpdateAsset).toHaveBeenCalledWith(ASSET_ID, {
			displayName: 'Nuevo nombre',
			defaultAltText: 'Nuevo alt',
		});
		expect(result.displayName).toBe('Nuevo nombre');
		expect(result.defaultAltText).toBe('Nuevo alt');
	});

	it('throws when asset is not found', async () => {
		mockFindAssetById.mockResolvedValue(null);

		await expect(
			updateAssetMetadata(ASSET_ID, { displayName: 'Nuevo nombre' }, INVITATION_ID),
		).rejects.toThrow('No se encontró el recurso solicitado.');
	});

	it('throws when invitationId does not match', async () => {
		mockFindAssetById.mockResolvedValue({ ...baseAsset, invitationId: 'other-inv' });

		await expect(
			updateAssetMetadata(ASSET_ID, { displayName: 'Nuevo nombre' }, INVITATION_ID),
		).rejects.toThrow('No se encontró el recurso solicitado.');
	});

	it('throws when asset is soft-deleted', async () => {
		mockFindAssetById.mockResolvedValue({
			...baseAsset,
			deletedAt: '2026-06-01T00:00:00.000Z',
		});

		await expect(
			updateAssetMetadata(ASSET_ID, { displayName: 'Nuevo nombre' }, INVITATION_ID),
		).rejects.toThrow('El recurso solicitado ha sido eliminado.');
	});

	it('rejects empty displayName', async () => {
		mockFindAssetById.mockResolvedValue({ ...baseAsset });

		await expect(
			updateAssetMetadata(ASSET_ID, { displayName: '  ' }, INVITATION_ID),
		).rejects.toThrow('El nombre visible no puede estar vacío.');
	});

	it('rejects displayName exceeding max length', async () => {
		mockFindAssetById.mockResolvedValue({ ...baseAsset });

		await expect(
			updateAssetMetadata(ASSET_ID, { displayName: 'x'.repeat(201) }, INVITATION_ID),
		).rejects.toThrow('no puede exceder');
	});

	it('rejects defaultAltText exceeding max length', async () => {
		mockFindAssetById.mockResolvedValue({ ...baseAsset });

		await expect(
			updateAssetMetadata(ASSET_ID, { defaultAltText: 'x'.repeat(501) }, INVITATION_ID),
		).rejects.toThrow('no puede exceder');
	});
});
