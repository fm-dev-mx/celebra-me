const mockGetSupabaseUrl = jest.fn();
const mockGetSupabaseServiceRoleKey = jest.fn();

jest.mock('@/lib/server/supabase-credentials', () => ({
	getSupabaseUrl: mockGetSupabaseUrl,
	getSupabaseServiceRoleKey: mockGetSupabaseServiceRoleKey,
}));

const mockIsDevEnvironment = jest.fn(() => true);
jest.mock('@/lib/environment', () => ({
	isDevEnvironment: mockIsDevEnvironment,
}));

const mockUploadOrReconcile = jest.fn();
jest.mock('@/lib/intake/services/cloudinary-assets', () => ({
	uploadOrReconcileCloudinaryAsset: (...args: unknown[]) => mockUploadOrReconcile(...args),
	buildCloudinaryDeliveryUrl: (cloudName: string, publicId: string) =>
		`https://res.cloudinary.com/${cloudName}/image/upload/v1/${publicId}.webp`,
	buildCloudinaryPublicId: () => 'xv/test/assets/test',
}));

import {
	CloudinaryStorageProvider,
	SupabaseLocalStorageProvider,
	getStorageProvider,
	resolveEffectiveTarget,
} from '@/lib/intake/services/storage-provider';

describe('StorageProvider Abstraction', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		jest.clearAllMocks();
		mockGetSupabaseUrl.mockReturnValue('http://127.0.0.1:54321');
		mockGetSupabaseServiceRoleKey.mockReturnValue('sb_secret_test');
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('SupabaseLocalStorageProvider', () => {
		const provider = new SupabaseLocalStorageProvider();

		it('uploads asset to local Supabase Storage and returns local delivery URL', async () => {
			const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
			} as Response);

			const result = await provider.uploadAsset({
				invitationId: 'inv-123',
				eventType: 'boda',
				slug: 'daniela-y-martin',
				key: 'hero-desktop',
				displayName: 'Portada',
				blob: new Blob(['fake-image-bytes'], { type: 'image/webp' }),
				mimeType: 'image/webp',
				width: 1200,
				height: 800,
				fileSize: 50000,
				validationVersion: 1,
				originalMimeType: 'image/jpeg',
				originalFileSize: 80000,
				sha256: 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
			});

			expect(result.provider).toBe('supabase');
			expect(result.bucket).toBe('invitation-assets');
			expect(result.storagePath).toBe('invitations/inv-123/hero-desktop-a1b2c3d4e5f6.webp');
			expect(result.deliveryUrl).toBe(
				'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/invitations/inv-123/hero-desktop-a1b2c3d4e5f6.webp',
			);
			expect(fetchSpy).toHaveBeenCalledWith(
				'http://127.0.0.1:54321/storage/v1/object/invitation-assets/invitations/inv-123/hero-desktop-a1b2c3d4e5f6.webp',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						apikey: 'sb_secret_test',
						Authorization: 'Bearer sb_secret_test',
						'Content-Type': 'image/webp',
					}),
				}),
			);
		});

		it('supports dry-run without making fetch calls', async () => {
			const fetchSpy = jest.spyOn(globalThis, 'fetch');

			const result = await provider.uploadAsset({
				invitationId: 'inv-123',
				eventType: 'boda',
				slug: 'daniela-y-martin',
				key: 'hero-desktop',
				displayName: 'Portada',
				blob: new Blob(['fake-image-bytes']),
				mimeType: 'image/webp',
				width: 1200,
				height: 800,
				fileSize: 50000,
				validationVersion: 1,
				originalMimeType: 'image/jpeg',
				originalFileSize: 80000,
				sha256: 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
				dryRun: true,
			});

			expect(result.provider).toBe('supabase');
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it('resolves delivery URLs correctly for local assets', () => {
			const url = provider.resolveDeliveryUrl({
				provider: 'supabase',
				bucket: 'invitation-assets',
				storagePath: 'invitations/inv-123/hero.webp',
			});
			expect(url).toBe(
				'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/invitations/inv-123/hero.webp',
			);
		});

		it('deletes assets from local storage via DELETE request', async () => {
			const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
				ok: true,
			} as Response);

			await provider.deleteAsset('invitations/inv-123/hero.webp', 'invitation-assets');

			expect(fetchSpy).toHaveBeenCalledWith(
				'http://127.0.0.1:54321/storage/v1/object/invitation-assets/invitations/inv-123/hero.webp',
				expect.objectContaining({
					method: 'DELETE',
					headers: expect.objectContaining({
						apikey: 'sb_secret_test',
						Authorization: 'Bearer sb_secret_test',
					}),
				}),
			);
		});
	});

	describe('CloudinaryStorageProvider', () => {
		const provider = new CloudinaryStorageProvider();

		it('delegates asset upload to Cloudinary SDK and returns Cloudinary metadata', async () => {
			mockUploadOrReconcile.mockResolvedValue({
				action: 'UPLOAD',
				publicId: 'boda/daniela-y-martin/assets/hero-desktop',
				version: 'v1234567890',
				secureUrl:
					'https://res.cloudinary.com/demo/image/upload/v1234567890/boda/daniela-y-martin/assets/hero-desktop.webp',
				bytes: 45000,
				width: 1200,
				height: 800,
				format: 'webp',
				metadata: { provider: 'cloudinary' },
			});

			const result = await provider.uploadAsset({
				invitationId: 'inv-123',
				eventType: 'boda',
				slug: 'daniela-y-martin',
				key: 'hero-desktop',
				displayName: 'Portada',
				blob: new Blob(['fake-image-bytes'], { type: 'image/webp' }),
				mimeType: 'image/webp',
				width: 1200,
				height: 800,
				fileSize: 45000,
				validationVersion: 1,
				originalMimeType: 'image/jpeg',
				originalFileSize: 80000,
				sha256: 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
			});

			expect(result.provider).toBe('cloudinary');
			expect(result.providerPublicId).toBe('boda/daniela-y-martin/assets/hero-desktop');
			expect(result.secureUrl).toContain('https://res.cloudinary.com');
			expect(result.deliveryUrl).toBe(result.secureUrl);
		});

		it('resolves delivery URLs from secure_url when present', () => {
			const url = provider.resolveDeliveryUrl({
				provider: 'cloudinary',
				bucket: 'invitation-assets',
				storagePath: 'boda/daniela-y-martin/assets/hero-desktop',
				secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/hero.webp',
			});
			expect(url).toBe('https://res.cloudinary.com/demo/image/upload/v1/hero.webp');
		});
	});

	describe('Factory resolution: getStorageProvider and resolveEffectiveTarget', () => {
		it('resolves local provider when targetEnv is local', () => {
			expect(resolveEffectiveTarget('local')).toBe('local');
			const provider = getStorageProvider('local');
			expect(provider.providerName).toBe('supabase');
		});

		it('resolves cloudinary provider when targetEnv is preview or production', () => {
			expect(resolveEffectiveTarget('preview')).toBe('preview');
			expect(resolveEffectiveTarget('production')).toBe('production');
			expect(getStorageProvider('preview').providerName).toBe('cloudinary');
			expect(getStorageProvider('production').providerName).toBe('cloudinary');
		});

		it('infers provider from VERCEL_ENV when present', () => {
			process.env.VERCEL_ENV = 'production';
			expect(resolveEffectiveTarget()).toBe('production');
			expect(getStorageProvider().providerName).toBe('cloudinary');

			process.env.VERCEL_ENV = 'preview';
			expect(resolveEffectiveTarget()).toBe('preview');
			expect(getStorageProvider().providerName).toBe('cloudinary');
		});

		it('infers provider from CELEBRA_RUNTIME_TARGET when set', () => {
			delete process.env.VERCEL_ENV;
			process.env.CELEBRA_RUNTIME_TARGET = 'preview';
			expect(resolveEffectiveTarget()).toBe('preview');
			expect(getStorageProvider().providerName).toBe('cloudinary');

			process.env.CELEBRA_RUNTIME_TARGET = 'local';
			expect(resolveEffectiveTarget()).toBe('local');
			expect(getStorageProvider().providerName).toBe('supabase');
		});
	});
});
