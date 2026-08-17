import {
	cloudinaryEraHostingMessage,
	findCloudinaryEraHostingViolations,
	findSupabaseStorageUrls,
	isCloudinaryEraInvitation,
	isCloudinaryHostedAsset,
} from '../../src/lib/intake/services/cloudinary-era-hosting';

describe('cloudinary-era hosting', () => {
	it('applies to client invitations in hosted environments and excludes demos', () => {
		expect(
			isCloudinaryEraInvitation({
				kind: 'client',
			}),
		).toBe(true);
		expect(
			isCloudinaryEraInvitation({
				kind: 'demo',
			}),
		).toBe(false);
	});

	it('requires cloudinary provider plus an http secure_url', () => {
		expect(
			isCloudinaryHostedAsset({
				provider: 'cloudinary',
				secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/hero.webp',
			}),
		).toBe(true);
		expect(isCloudinaryHostedAsset({ provider: 'supabase', secureUrl: null })).toBe(false);
		expect(isCloudinaryHostedAsset({ provider: 'cloudinary', secureUrl: '' })).toBe(false);
	});

	it('lists referenced assets that are still on Supabase', () => {
		expect(
			findCloudinaryEraHostingViolations([
				{
					key: 'hero-desktop',
					provider: 'supabase',
					secureUrl: null,
				},
				{
					key: 'family',
					provider: 'cloudinary',
					secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/family.webp',
				},
			]),
		).toEqual(['hero-desktop']);
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
		expect(cloudinaryEraHostingMessage(['hero-desktop'])).toMatch(/Cloudinary/);
	});
});
