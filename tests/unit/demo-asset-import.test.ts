const mockFindInvitation = jest.fn();
const mockFindPublishedContent = jest.fn();
const mockResolveAssetSlug = jest.fn();
const mockGetEventAsset = jest.fn();
const mockIsEventAssetKey = jest.fn();
const mockIsValidEvent = jest.fn();
const mockUploadToStorage = jest.fn();
const mockCreateAsset = jest.fn();

jest.mock('@/lib/intake/repositories/invitation.repository', () => ({
	findInvitationById: mockFindInvitation,
}));

jest.mock('@/lib/intake/repositories/published-invitation-content.repository', () => ({
	findPublishedByInvitationId: mockFindPublishedContent,
}));

jest.mock('@/lib/assets/asset-slug', () => ({
	resolveAssetSlug: mockResolveAssetSlug,
}));

jest.mock('@/lib/assets/asset-registry', () => ({
	isValidEvent: mockIsValidEvent,
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

const INVITATION_ID = 'inv-1';
const DEFAULT_METADATA = { src: '/assets/hero.webp', width: 1080, height: 1920, format: 'webp' };

function mockFetch() {
	globalThis.fetch = jest.fn().mockResolvedValue({
		ok: true,
		blob: jest.fn().mockResolvedValue(new Blob(['fake'], { type: 'image/webp' })),
	} as unknown as Response);
}

function createMockAssetResult(overrides: Record<string, unknown> = {}) {
	return {
		id: 'new-asset-id',
		invitationId: INVITATION_ID,
		displayName: 'hero',
		bucket: 'invitation-assets',
		storagePath: `invitations/${INVITATION_ID}/original/new-asset-id.webp`,
		mimeType: 'image/webp',
		width: 1080,
		height: 1920,
		fileSize: 10,
		...overrides,
	};
}

beforeEach(() => {
	jest.clearAllMocks();
});

afterEach(() => {
	delete (globalThis as any).fetch;
});

describe('importDemoAsset', () => {
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

	it('rejects unresolvable demo key when metadata is missing', async () => {
		mockIsEventAssetKey.mockReturnValue(true);
		mockIsValidEvent.mockReturnValue(true);
		mockFindInvitation.mockResolvedValue({
			id: INVITATION_ID,
			snapshot: { previewSlug: 'demo-xv-test' },
		});
		mockFindPublishedContent.mockResolvedValue(null);
		mockResolveAssetSlug.mockReturnValue('demo-xv-test');
		mockGetEventAsset.mockReturnValue(undefined);

		await expect(importDemoAsset(INVITATION_ID, 'nonexistent-key')).rejects.toThrow(
			'No se encontró la imagen de demo',
		);
	});

	describe('successful import', () => {
		beforeEach(() => {
			mockIsEventAssetKey.mockReturnValue(true);
			mockIsValidEvent.mockReturnValue(true);
			mockFindPublishedContent.mockResolvedValue(null);
			mockUploadToStorage.mockResolvedValue(undefined);
			mockFetch();
		});

		it('imports a demo asset with basic invitation', async () => {
			mockFindInvitation.mockResolvedValue({
				id: INVITATION_ID,
				snapshot: { previewSlug: 'demo-xv-test' },
			});
			mockResolveAssetSlug.mockReturnValue('demo-xv-test');
			mockGetEventAsset.mockReturnValue(DEFAULT_METADATA);
			mockCreateAsset.mockResolvedValue(createMockAssetResult({ displayName: 'hero' }));

			const result = await importDemoAsset(INVITATION_ID, 'hero');

			expect(result.asset.id).toBe('new-asset-id');
			expect(result.asset.displayName).toBe('hero');
			expect(result.src).toBe('https://cdn.test/asset.webp');
			expect(mockUploadToStorage).toHaveBeenCalled();
			expect(mockFindPublishedContent).toHaveBeenCalledWith(INVITATION_ID);
			expect(mockResolveAssetSlug).toHaveBeenCalled();
			expect(mockCreateAsset).toHaveBeenCalledWith(
				expect.objectContaining({
					invitationId: INVITATION_ID,
					displayName: 'hero',
					width: 1080,
					height: 1920,
				}),
			);
		});

		it('falls back to snapshot.previewSlug for demo/legacy invitations', async () => {
			mockFindInvitation.mockResolvedValue({
				id: INVITATION_ID,
				kind: 'demo',
				slug: null,
				eventType: 'bautizo',
				snapshot: { previewSlug: 'demo-bautismo-angelic-presence' },
			});
			mockResolveAssetSlug.mockReturnValue('demo-bautismo-angelic-presence');
			mockGetEventAsset.mockReturnValue({
				src: '/assets/interlude-02.webp',
				width: 1080,
				height: 1920,
				format: 'webp',
			});
			mockCreateAsset.mockResolvedValue(
				createMockAssetResult({ displayName: 'interlude02' }),
			);

			const result = await importDemoAsset(INVITATION_ID, 'interlude02');

			expect(result.asset.id).toBe('new-asset-id');
			expect(mockFindPublishedContent).toHaveBeenCalledWith(INVITATION_ID);
			expect(mockResolveAssetSlug).toHaveBeenCalled();
			expect(mockGetEventAsset).toHaveBeenCalledWith(
				'demo-bautismo-angelic-presence',
				'interlude02',
			);
		});

		it('resolves slug through resolveAssetSlug for client invitations', async () => {
			mockFindInvitation.mockResolvedValue({
				id: INVITATION_ID,
				kind: 'client',
				slug: 'luna-y-estrella',
				eventType: 'primera-comunion',
				snapshot: { previewSlug: 'demo-xv-jewelry-box' },
			});
			mockResolveAssetSlug.mockReturnValue('luna-y-estrella-primera-comunion');
			mockGetEventAsset.mockReturnValue({
				src: '/assets/interlude-02.webp',
				width: 1080,
				height: 1920,
				format: 'webp',
			});
			mockCreateAsset.mockResolvedValue(
				createMockAssetResult({ displayName: 'interlude02' }),
			);

			const result = await importDemoAsset(INVITATION_ID, 'interlude02');

			expect(result.asset.id).toBe('new-asset-id');
			expect(mockResolveAssetSlug).toHaveBeenCalled();
			expect(mockGetEventAsset).toHaveBeenCalledWith(
				'luna-y-estrella-primera-comunion',
				'interlude02',
			);
			expect(mockFindPublishedContent).toHaveBeenCalledWith(INVITATION_ID);
		});
	});
});
