import {
	remoteMediaHostingMessage,
	findSupabaseStorageUrls,
	isRemoteMediaInvitation,
	isRemoteHostedAsset,
} from '../../src/lib/intake/services/remote-media-hosting';

describe('remote media hosting', () => {
	it('applies to client invitations in hosted environments and excludes demos', () => {
		expect(
			isRemoteMediaInvitation({
				kind: 'client',
			}),
		).toBe(true);
		expect(
			isRemoteMediaInvitation({
				kind: 'demo',
			}),
		).toBe(false);
	});

	it('requires the r2 provider plus an http secure_url', () => {
		expect(
			isRemoteHostedAsset({
				provider: 'r2',
				secureUrl: 'https://media.celebra-me.com/invitations/xv/demo/hero.webp',
			}),
		).toBe(true);
		expect(
			isRemoteHostedAsset({
				provider: 'r2',
				secureUrl: 'https://media.celebra-me.com/invitations/xv/demo/hero-0.webp',
			}),
		).toBe(true);
		expect(isRemoteHostedAsset({ provider: 'supabase', secureUrl: null })).toBe(false);
		expect(isRemoteHostedAsset({ provider: 'r2', secureUrl: '' })).toBe(false);
	});

	it('detects Supabase storage URLs', () => {
		expect(
			findSupabaseStorageUrls({
				src: 'https://ineitkdkyrxqyressllp.supabase.co/storage/v1/object/public/x',
			}),
		).toHaveLength(1);
		expect(
			findSupabaseStorageUrls({
				src: 'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/test.webp',
			}),
		).toHaveLength(1);
		expect(
			findSupabaseStorageUrls({
				src: 'http://localhost:54321/storage/v1/object/public/invitation-assets/test.webp',
			}),
		).toHaveLength(1);
		expect(remoteMediaHostingMessage(['hero-desktop'])).toMatch(/servicio de imágenes/);
	});
});
