const mockGetSupabaseUrl = jest.fn();
const mockGetSupabaseServiceRoleKey = jest.fn();

jest.mock('@/lib/server/supabase-credentials', () => ({
	getSupabaseUrl: mockGetSupabaseUrl,
	getSupabaseServiceRoleKey: mockGetSupabaseServiceRoleKey,
}));

import {
	SupabaseLocalStorageProvider,
	getStorageProvider,
	resolveEffectiveTarget,
} from '@/lib/intake/services/storage-provider';

import { installInvitationMediaBinding } from '@/lib/intake/services/r2-invitation-media';
import {
	asHostedDeploy,
	asLocalDevServer,
	asUndeclaredBuiltBundle,
} from '@tests/helpers/deploy-identity';

// This suite models a local Astro process, whose storage target follows the local
// deploy identity (a built bundle without CELEBRA_DEPLOY_ENV would fail closed).
beforeEach(asLocalDevServer);

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
		jest.restoreAllMocks();
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
	});

	describe('Factory resolution: getStorageProvider and resolveEffectiveTarget', () => {
		it('resolves local provider when targetEnv is local', () => {
			expect(resolveEffectiveTarget('local')).toBe('local');
			const provider = getStorageProvider('local');
			expect(provider.providerName).toBe('supabase');
		});

		it('refuses hosted targets without the INVITATION_MEDIA R2 binding', () => {
			expect(resolveEffectiveTarget('preview')).toBe('preview');
			expect(resolveEffectiveTarget('production')).toBe('production');
			expect(() => getStorageProvider('preview')).toThrow('INVITATION_MEDIA R2 binding');
			expect(() => getStorageProvider('production')).toThrow('INVITATION_MEDIA R2 binding');
		});

		it('resolves the R2 provider on hosted targets once the Worker installed the binding', () => {
			installInvitationMediaBinding({
				INVITATION_MEDIA: { head: jest.fn(), put: jest.fn() },
			});
			expect(getStorageProvider('preview').providerName).toBe('r2');
			expect(getStorageProvider('production').providerName).toBe('r2');
		});

		it('infers provider from the declared deploy identity', () => {
			installInvitationMediaBinding({
				INVITATION_MEDIA: { head: jest.fn(), put: jest.fn() },
			});
			asHostedDeploy('production');
			expect(resolveEffectiveTarget()).toBe('production');
			expect(getStorageProvider().providerName).toBe('r2');

			asHostedDeploy('preview');
			expect(resolveEffectiveTarget()).toBe('preview');
			expect(getStorageProvider().providerName).toBe('r2');
		});

		it('fails closed for a built bundle without a deploy identity', () => {
			asUndeclaredBuiltBundle();
			delete process.env.CELEBRA_RUNTIME_TARGET;
			process.env.SUPABASE_URL = 'https://example-project.supabase.co';
			expect(() => resolveEffectiveTarget()).toThrow(/must declare CELEBRA_DEPLOY_ENV/);
		});

		it('infers provider from CELEBRA_RUNTIME_TARGET when set', () => {
			installInvitationMediaBinding({
				INVITATION_MEDIA: { head: jest.fn(), put: jest.fn() },
			});
			process.env.CELEBRA_RUNTIME_TARGET = 'preview';
			expect(resolveEffectiveTarget()).toBe('preview');
			expect(getStorageProvider().providerName).toBe('r2');

			process.env.CELEBRA_RUNTIME_TARGET = 'local';
			expect(resolveEffectiveTarget()).toBe('local');
			expect(getStorageProvider().providerName).toBe('supabase');
		});

		it('never resolves Production storage from CELEBRA_RUNTIME_TARGET', () => {
			process.env.CELEBRA_RUNTIME_TARGET = 'production';
			expect(resolveEffectiveTarget()).toBe('local');
		});
	});
});
