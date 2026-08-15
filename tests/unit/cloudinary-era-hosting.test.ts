import {
	CLOUDINARY_ERA_CUTOFF,
	cloudinaryEraHostingMessage,
	findCloudinaryEraHostingViolations,
	findSupabaseStorageUrls,
	isCloudinaryEraInvitation,
	isCloudinaryHostedAsset,
} from '../../src/lib/intake/services/cloudinary-era-hosting';

describe('cloudinary-era hosting', () => {
	it('applies to client invitations created or published on or after the Abril cutoff', () => {
		expect(
			isCloudinaryEraInvitation({
				kind: 'client',
				createdAt: '2026-07-26T00:00:00.000Z',
			}),
		).toBe(true);
		expect(
			isCloudinaryEraInvitation({
				kind: 'client',
				createdAt: '2026-07-17T00:00:00.000Z',
				publishedAt: '2026-08-13T00:00:00.000Z',
			}),
		).toBe(true);
		expect(
			isCloudinaryEraInvitation({
				kind: 'client',
				createdAt: '2026-06-21T00:00:00.000Z',
				publishedAt: '2026-07-01T00:00:00.000Z',
			}),
		).toBe(false);
		expect(
			isCloudinaryEraInvitation({
				kind: 'demo',
				createdAt: '2026-08-15T00:00:00.000Z',
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
		expect(cloudinaryEraHostingMessage(['hero-desktop'])).toMatch(/Cloudinary/);
		expect(CLOUDINARY_ERA_CUTOFF).toBe('2026-07-26T00:00:00.000Z');
	});
});
