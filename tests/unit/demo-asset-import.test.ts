const mockFindInvitation = jest.fn();
const mockGetEventAsset = jest.fn();
const mockIsEventAssetKey = jest.fn();
const mockUploadToStorage = jest.fn();
const mockCreateAsset = jest.fn();

jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	findInvitationById: mockFindInvitation,
}));

jest.mock('@/lib/assets/asset-registry', () => ({
	isEventAssetKey: (...args: unknown[]) => mockIsEventAssetKey(...args),
	getEventAsset: mockGetEventAsset,
}));

jest.mock('@/lib/intake/storage', () => ({
	uploadToStorage: mockUploadToStorage,
	getPublicUrl: jest.fn().mockReturnValue('https://cdn.test/asset.webp'),
	DEFAULT_BUCKET: 'invitation-assets',
}));

jest.mock('@/lib/intake/repositories/asset.repository', () => ({
	createAsset: mockCreateAsset,
}));

import { importDemoAsset } from '@/lib/intake/services/asset.service';

beforeEach(() => {
	jest.clearAllMocks();
});

describe('importDemoAsset', () => {
	const INVITATION_ID = 'inv-1';

	it('rejects invalid demoKey', async () => {
		mockIsEventAssetKey.mockReturnValue(false);

		await expect(importDemoAsset(INVITATION_ID, 'invalid-key')).rejects.toThrow(
			'La clave de imagen de demo no es válida.',
		);
	});

	it('rejects nonexistent invitation', async () => {
		mockIsEventAssetKey.mockReturnValue(true);
		mockFindInvitation.mockResolvedValue(null);

		await expect(importDemoAsset(INVITATION_ID, 'hero')).rejects.toThrow(
			'No se encontró la invitación.',
		);
	});

	it('rejects invitation without previewSlug', async () => {
		mockIsEventAssetKey.mockReturnValue(true);
		mockFindInvitation.mockResolvedValue({ id: INVITATION_ID, snapshot: {} as any });

		await expect(importDemoAsset(INVITATION_ID, 'hero')).rejects.toThrow(
			'La invitación no tiene configuración visual asociada',
		);
	});

	it('rejects unresolvable demo key', async () => {
		mockIsEventAssetKey.mockReturnValue(true);
		mockFindInvitation.mockResolvedValue({
			id: INVITATION_ID,
			snapshot: { previewSlug: 'demo-xv-test' },
		});
		mockGetEventAsset.mockReturnValue(undefined);

		await expect(importDemoAsset(INVITATION_ID, 'nonexistent-key')).rejects.toThrow(
			'No se encontró la imagen de demo',
		);
	});

	it('imports successfully from demo', async () => {
		mockIsEventAssetKey.mockReturnValue(true);
		mockFindInvitation.mockResolvedValue({
			id: INVITATION_ID,
			snapshot: { previewSlug: 'demo-xv-test' },
		});
		mockGetEventAsset.mockReturnValue({
			src: '/assets/hero.webp',
			width: 1080,
			height: 1920,
			format: 'webp',
		});
		globalThis.fetch = jest.fn().mockResolvedValue({
			ok: true,
			blob: jest.fn().mockResolvedValue(new Blob(['fake-image'], { type: 'image/webp' })),
		} as unknown as Response);
		mockUploadToStorage.mockResolvedValue(undefined);
		mockCreateAsset.mockResolvedValue({
			id: 'new-asset-id',
			invitationId: INVITATION_ID,
			displayName: 'hero',
			bucket: 'invitation-assets',
			storagePath: `invitations/${INVITATION_ID}/original/new-asset-id.webp`,
			mimeType: 'image/webp',
			width: 1080,
			height: 1920,
			fileSize: 10,
		});

		const result = await importDemoAsset(INVITATION_ID, 'hero');

		expect(result.asset.id).toBe('new-asset-id');
		expect(result.asset.displayName).toBe('hero');
		expect(result.src).toBe('https://cdn.test/asset.webp');
		expect(mockUploadToStorage).toHaveBeenCalled();
		expect(mockCreateAsset).toHaveBeenCalledWith(
			expect.objectContaining({
				invitationId: INVITATION_ID,
				displayName: 'hero',
				width: 1080,
				height: 1920,
			}),
		);
	});
});
