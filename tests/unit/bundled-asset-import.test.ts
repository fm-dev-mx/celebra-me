const mockFindInvitation = jest.fn();
const mockFindPublishedContent = jest.fn();
const mockResolveAssetSlug = jest.fn();
const mockGetEventAsset = jest.fn();
const mockIsEventAssetKey = jest.fn();
const mockIsValidEvent = jest.fn();
const mockBucketPut = jest.fn();
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
	getEventAsset: mockGetEventAsset,
}));

jest.mock('@/lib/assets/asset-keys', () => ({
	isEventAssetKey: (...args: unknown[]) => mockIsEventAssetKey(...args),
}));

jest.mock('@/lib/intake/storage', () => ({
	getPublicUrl: jest.fn().mockReturnValue('https://cdn.test/asset.webp'),
	uploadToStorage: jest.fn().mockResolvedValue('https://cdn.test/asset.webp'),
	DEFAULT_BUCKET: 'invitation-assets',
}));

jest.mock('@/lib/intake/repositories/asset.repository', () => ({
	createAsset: mockCreateAsset,
}));

jest.mock('@/lib/images/responsive-variants', () => ({
	...jest.requireActual('@/lib/images/responsive-variants'),
	encodeResponsiveVariants: jest.fn(async () =>
		[480, 800, 1280, 1920].map((width) => ({ width, data: new Uint8Array([1]) })),
	),
}));
jest.mock('@/lib/intake/services/asset-policy', () => ({
	normalizeInvitationImage: jest.fn().mockResolvedValue({
		blob: {
			arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
			type: 'image/webp',
		},
		width: 1080,
		height: 1920,
		fileSize: 9,
		mimeType: 'image/webp',
		originalMimeType: 'image/webp',
		originalFileSize: 4,
		validationVersion: 1,
	}),
}));

import { importBundledAsset } from '@/lib/intake/services/asset.service';
import { installInvitationMediaBinding } from '@/lib/intake/services/r2-invitation-media';

const INVITATION_ID = 'inv-1';
const DEFAULT_METADATA = { src: '/assets/hero.webp', width: 1080, height: 1920, format: 'webp' };
const originalFetch = globalThis.fetch;

function mockFetch() {
	globalThis.fetch = jest.fn().mockResolvedValue({
		ok: true,
		blob: jest.fn().mockResolvedValue(new Blob(['fake'], { type: 'image/webp' })),
		headers: { get: jest.fn().mockReturnValue('image/webp') },
	} as unknown as Response);
}

function createMockAssetResult(overrides: Record<string, unknown> = {}) {
	return {
		id: 'new-asset-id',
		invitationId: INVITATION_ID,
		displayName: 'hero',
		bucket: 'invitation-assets',
		storagePath: 'xv/demo/assets/hero-abc',
		provider: 'supabase',
		providerPublicId: null,
		secureUrl: 'https://cdn.test/asset.webp',
		sha256: 'abc',
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
	globalThis.fetch = originalFetch;
});

import { asLocalDevServer } from '@tests/helpers/deploy-identity';

// This suite models a local Astro process, whose storage target follows the local
// deploy identity (a built bundle without CELEBRA_DEPLOY_ENV would fail closed).
beforeEach(asLocalDevServer);

describe('importBundledAsset', () => {
	it('rejects invalid bundledKey', async () => {
		mockIsEventAssetKey.mockReturnValue(false);

		await expect(importBundledAsset(INVITATION_ID, 'invalid-key')).rejects.toThrow(
			'La clave de imagen incluida no es válida.',
		);
	});

	it('rejects nonexistent invitation', async () => {
		mockIsEventAssetKey.mockReturnValue(true);
		mockFindInvitation.mockResolvedValue(null);

		await expect(importBundledAsset(INVITATION_ID, 'hero')).rejects.toThrow(
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

		await expect(importBundledAsset(INVITATION_ID, 'nonexistent-key')).rejects.toThrow(
			'No se encontró la imagen incluida',
		);
	});

	describe('successful import', () => {
		beforeEach(() => {
			mockIsEventAssetKey.mockReturnValue(true);
			mockIsValidEvent.mockReturnValue(true);
			mockFindPublishedContent.mockResolvedValue(null);
			mockFetch();
		});

		it('imports a bundled asset with basic invitation', async () => {
			mockFindInvitation.mockResolvedValue({
				id: INVITATION_ID,
				eventType: 'xv',
				slug: null,
				snapshot: { previewSlug: 'demo-xv-test' },
			});
			mockResolveAssetSlug.mockReturnValue('demo-xv-test');
			mockGetEventAsset.mockReturnValue(DEFAULT_METADATA);
			mockCreateAsset.mockResolvedValue(createMockAssetResult({ displayName: 'hero' }));

			const result = await importBundledAsset(INVITATION_ID, 'hero');

			expect(result.asset.id).toBe('new-asset-id');
			expect(result.asset.displayName).toBe('hero');
			expect(mockFindPublishedContent).toHaveBeenCalledWith(INVITATION_ID);
			expect(mockResolveAssetSlug).toHaveBeenCalled();
			expect(mockCreateAsset).toHaveBeenCalledWith(
				expect.objectContaining({
					invitationId: INVITATION_ID,
					displayName: 'hero',
					width: 1080,
					height: 1920,
					provider: 'supabase',
					bucket: 'invitation-assets',
				}),
			);
		});

		it('imports a bundled asset to R2 when in preview environment', async () => {
			process.env.CELEBRA_RUNTIME_TARGET = 'preview';
			mockBucketPut.mockResolvedValue(undefined);
			installInvitationMediaBinding({
				INVITATION_MEDIA: { head: jest.fn().mockResolvedValue(null), put: mockBucketPut },
			});
			mockFindInvitation.mockResolvedValue({
				id: INVITATION_ID,
				eventType: 'xv',
				slug: null,
				snapshot: { previewSlug: 'demo-xv-test' },
			});
			mockResolveAssetSlug.mockReturnValue('demo-xv-test');
			mockGetEventAsset.mockReturnValue(DEFAULT_METADATA);
			mockCreateAsset.mockResolvedValue(createMockAssetResult({ displayName: 'hero' }));

			const result = await importBundledAsset(INVITATION_ID, 'hero');

			expect(result.asset.id).toBe('new-asset-id');
			// The original, then one WebP per width variant.
			expect(mockBucketPut).toHaveBeenCalledTimes(5);
			const [objectKey, , putOptions] = mockBucketPut.mock.calls[0];
			expect(objectKey).toMatch(
				/^invitations\/xv\/[a-z0-9-]+\/bundled-hero-[a-z0-9]+-[a-f0-9]{64}\.webp$/,
			);
			expect(mockBucketPut.mock.calls.slice(1).map(([key]) => key)).toEqual(
				[480, 800, 1280, 1920].map((width) =>
					objectKey.replace(/\.webp$/, `.w${width}.webp`),
				),
			);
			expect(putOptions.httpMetadata.contentType).toBe('image/webp');
			expect(mockCreateAsset).toHaveBeenCalledWith(
				expect.objectContaining({
					invitationId: INVITATION_ID,
					displayName: 'hero',
					width: 1080,
					height: 1920,
					provider: 'r2',
					bucket: 'celebra-me-invitation-media-staging',
					providerPublicId: objectKey,
					storagePath: objectKey,
					secureUrl: `https://media-staging.celebra-me.com/${objectKey}`,
				}),
			);
			delete process.env.CELEBRA_RUNTIME_TARGET;
		});

		it('falls back to snapshot.previewSlug for demo/legacy invitations', async () => {
			mockFindInvitation.mockResolvedValue({
				id: INVITATION_ID,
				kind: 'demo',
				slug: null,
				eventType: 'bautizo',
				snapshot: { previewSlug: 'demo-bautizo-angelic-presence' },
			});
			mockResolveAssetSlug.mockReturnValue('demo-bautizo-angelic-presence');
			mockGetEventAsset.mockReturnValue({
				src: '/assets/interlude-02.webp',
				width: 1080,
				height: 1920,
				format: 'webp',
			});
			mockCreateAsset.mockResolvedValue(
				createMockAssetResult({ displayName: 'interlude02' }),
			);

			const result = await importBundledAsset(INVITATION_ID, 'interlude02');

			expect(result.asset.id).toBe('new-asset-id');
			expect(mockFindPublishedContent).toHaveBeenCalledWith(INVITATION_ID);
			expect(mockResolveAssetSlug).toHaveBeenCalled();
			expect(mockGetEventAsset).toHaveBeenCalledWith(
				'demo-bautizo-angelic-presence',
				'interlude02',
			);
		});

		it('resolves slug through resolveAssetSlug for client invitations', async () => {
			mockFindInvitation.mockResolvedValue({
				id: INVITATION_ID,
				kind: 'client',
				slug: 'gemelas-fixture',
				eventType: 'primera-comunion',
				snapshot: { previewSlug: 'demo-xv-jewelry-box' },
			});
			mockResolveAssetSlug.mockReturnValue('gemelas-fixture-primera-comunion');
			mockGetEventAsset.mockReturnValue({
				src: '/assets/interlude-02.webp',
				width: 1080,
				height: 1920,
				format: 'webp',
			});
			mockCreateAsset.mockResolvedValue(
				createMockAssetResult({ displayName: 'interlude02' }),
			);

			const result = await importBundledAsset(INVITATION_ID, 'interlude02');

			expect(result.asset.id).toBe('new-asset-id');
			expect(mockResolveAssetSlug).toHaveBeenCalled();
			expect(mockGetEventAsset).toHaveBeenCalledWith(
				'gemelas-fixture-primera-comunion',
				'interlude02',
			);
			expect(mockFindPublishedContent).toHaveBeenCalledWith(INVITATION_ID);
		});
	});
});
