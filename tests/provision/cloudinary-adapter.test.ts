/**
 * cloudinary-adapter.test.ts — Comprehensive regression tests for Cloudinary asset provider & Abril migration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
	buildCloudinaryPublicId,
	buildCloudinaryOgImageUrl,
	assertCloudinaryPublicIdEnvironment,
	classifyCloudinaryPublicIdEnvironment,
	assertCloudinaryMutationTarget,
	getCloudinaryErrorStatus,
	uploadOrReconcileCloudinaryAsset,
	verifyCloudinaryAsset,
} from '../../src/lib/intake/services/cloudinary-assets.ts';
import {
	ABRIL_ASSET_SPECS,
	abrilInvitation,
	buildAbrilPublishedContent,
} from '../../scripts/provision/invitations/abril-michelle-becerra-rea.ts';
import { buildSemanticAssetMap } from '../../scripts/provision/normalized-invitation-release.ts';

describe('Cloudinary Adapter & Managed Asset Provider', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		delete process.env.CLOUDINARY_CLOUD_NAME;
		delete process.env.CLOUDINARY_API_KEY;
		delete process.env.CLOUDINARY_API_SECRET;
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('Public ID & Hierarchy Generation', () => {
		it('builds deterministic immutable public ID under {eventType}/{slug}/assets without leading slash or extension', () => {
			const dummySha = createHash('sha256').update('hello-world').digest('hex');
			const publicId = buildCloudinaryPublicId({
				eventType: 'xv',
				slug: 'abril-michelle-becerra-rea',
				key: 'hero-desktop',
				sha256: dummySha,
			});
			expect(publicId).toBe(
				`xv/abril-michelle-becerra-rea/assets/hero-desktop-${dummySha.slice(0, 12)}`,
			);
			expect(publicId.startsWith('/')).toBe(false);
			expect(publicId.endsWith('.webp')).toBe(false);
		});

		it('builds isolated Preview and Production IDs while retaining legacy read classification', () => {
			const sha256 = createHash('sha256').update('environment-isolation').digest('hex');
			const input = {
				eventType: 'xv',
				slug: 'valentina-hernandez',
				key: 'hero',
				sha256,
			};
			const preview = buildCloudinaryPublicId({ ...input, targetEnvironment: 'preview' });
			const production = buildCloudinaryPublicId({
				...input,
				targetEnvironment: 'production',
			});
			expect(preview).toBe(
				'preview/xv/valentina-hernandez/assets/hero-' + sha256.slice(0, 12),
			);
			expect(production).toBe(
				'production/xv/valentina-hernandez/assets/hero-' + sha256.slice(0, 12),
			);
			expect(classifyCloudinaryPublicIdEnvironment(preview)).toBe('preview');
			expect(
				classifyCloudinaryPublicIdEnvironment('xv/valentina-hernandez/assets/hero-abc'),
			).toBe('legacy');
			expect(() => assertCloudinaryPublicIdEnvironment(preview, 'production')).toThrow(
				'namespace mismatch',
			);
			expect(() =>
				assertCloudinaryPublicIdEnvironment(
					'xv/valentina-hernandez/assets/hero-abc',
					'preview',
					{ allowLegacyRead: true },
				),
			).not.toThrow();
		});
		it('blocks mutation of legacy, cross-environment, and other invitation assets', () => {
			const target = { environment: 'preview' as const, eventType: 'xv', slug: 'valentina-hernandez' };
			expect(() =>
				assertCloudinaryMutationTarget(
					'preview/xv/valentina-hernandez/assets/hero-abc',
					target,
				),
			).not.toThrow();
			for (const publicId of [
				'xv/valentina-hernandez/assets/hero-abc',
				'production/xv/valentina-hernandez/assets/hero-abc',
				'preview/xv/other-invitation/assets/hero-abc',
			]) {
				expect(() => assertCloudinaryMutationTarget(publicId, target)).toThrow();
			}
		});
		it('changes the public ID when the content hash changes', () => {
			const first = createHash('sha256').update('hero-bytes-v1').digest('hex');
			const second = createHash('sha256').update('hero-bytes-v2').digest('hex');
			const input = {
				eventType: 'xv',
				slug: 'renata',
				key: 'hero-desktop',
			};
			expect(buildCloudinaryPublicId({ ...input, sha256: first })).not.toBe(
				buildCloudinaryPublicId({ ...input, sha256: second }),
			);
		});

		it('uses eventType for non-XV invitations', () => {
			const dummySha = createHash('sha256').update('hello-world').digest('hex');
			expect(
				buildCloudinaryPublicId({
					eventType: 'boda',
					slug: 'victoria-y-roberto',
					key: 'hero-desktop',
					sha256: dummySha,
				}),
			).toBe(`boda/victoria-y-roberto/assets/hero-desktop-${dummySha.slice(0, 12)}`);
		});

		it('supports explicit custom assetFolder override without leading/trailing slashes', () => {
			const dummySha = createHash('sha256').update('test-folder').digest('hex');
			const publicId = buildCloudinaryPublicId({
				eventType: 'xv',
				slug: 'abril-michelle-becerra-rea',
				key: 'gallery-02-bw-cake',
				sha256: dummySha,
				assetFolder: '/xv/abril-michelle-becerra-rea/assets/',
			});
			expect(publicId).toBe(
				`xv/abril-michelle-becerra-rea/assets/gallery-02-bw-cake-${dummySha.slice(0, 12)}`,
			);
		});
	});

	describe('Cloudinary error status', () => {
		it('reads http_code from the SDK nested error object used on missing resources', () => {
			expect(
				getCloudinaryErrorStatus({
					request_options: {},
					error: { message: 'Resource not found - example', http_code: 404 },
				}),
			).toBe(404);
			expect(getCloudinaryErrorStatus({ http_code: 401 })).toBe(401);
			expect(getCloudinaryErrorStatus({ error: {} })).toBeUndefined();
		});
	});

	describe('OpenGraph Social Image Transformation', () => {
		it('derives explicit 1200x630 horizontal transformation URL', () => {
			const rawUrl =
				'https://res.cloudinary.com/celebra-me/image/upload/v1/xv/abril-michelle-becerra-rea/assets/hero-desktop-12345.webp';
			const ogUrl = buildCloudinaryOgImageUrl(rawUrl);
			expect(ogUrl).toBe(
				'https://res.cloudinary.com/celebra-me/image/upload/c_fill,g_auto,w_1200,h_630,q_auto,f_auto/v1/xv/abril-michelle-becerra-rea/assets/hero-desktop-12345.webp',
			);
		});

		it('returns unchanged URL if not a Cloudinary upload URL', () => {
			const rawUrl =
				'https://storage.supabase.co/v1/object/public/invitation-assets/test.webp';
			expect(buildCloudinaryOgImageUrl(rawUrl)).toBe(rawUrl);
		});
	});

	describe('Precondition & Credential Checks', () => {
		it('fails cleanly before mutation when Cloudinary credentials are missing', async () => {
			process.env.CLOUDINARY_CLOUD_NAME = '';
			process.env.CLOUDINARY_API_KEY = '';
			process.env.CLOUDINARY_API_SECRET = '';
			const dummyBytes = new Uint8Array([1, 2, 3, 4]);
			const dummySha = createHash('sha256').update(dummyBytes).digest('hex');

			await expect(
				uploadOrReconcileCloudinaryAsset({
					targetEnvironment: 'preview',
					eventType: 'xv',
					slug: 'abril-michelle-becerra-rea',
					key: 'hero-desktop',
					displayName: 'Hero Desktop',
					alt: 'Hero Alt',
					bytes: dummyBytes,
					sha256: dummySha,
					mimeType: 'image/webp',
					dryRun: false,
				}),
			).rejects.toThrow('Stop before mutation');
		});

		it('returns predicted outcome without error during dryRun even when credentials are missing', async () => {
			const dummyBytes = new Uint8Array([1, 2, 3, 4]);
			const dummySha = createHash('sha256').update(dummyBytes).digest('hex');
			const cloudinaryModule = await import('cloudinary');
			const resourceSpy = jest
				.spyOn(cloudinaryModule.v2.api, 'resource')
				.mockRejectedValue(Object.assign(new Error('Not Found'), { http_code: 404 }));

			try {
				const res = await uploadOrReconcileCloudinaryAsset({
					targetEnvironment: 'preview',
					eventType: 'xv',
					slug: 'abril-michelle-becerra-rea',
					key: 'hero-desktop',
					displayName: 'Hero Desktop',
					alt: 'Hero Alt',
					bytes: dummyBytes,
					sha256: dummySha,
					mimeType: 'image/webp',
					dryRun: true,
				});

				expect(res.action).toBe('UPLOAD');
				expect(res.provider).toBe('cloudinary');
				expect(res.secureUrl).toContain('res.cloudinary.com');
				expect(res.publicId).toBe(
					`preview/xv/abril-michelle-becerra-rea/assets/hero-desktop-${dummySha.slice(0, 12)}`,
				);
			} finally {
				resourceSpy.mockRestore();
			}
		});
	});

	describe('Abril Michelle Asset Specifications & Photo Swap Contract', () => {
		it('declares 11 unique physical WebP files across 10 visual placements with no duplicate relative paths', () => {
			expect(ABRIL_ASSET_SPECS.length).toBe(11);

			const relativePaths = ABRIL_ASSET_SPECS.map((s) => s.relativePath);
			const uniquePaths = new Set(relativePaths);
			expect(uniquePaths.size).toBe(11);

			for (const path of relativePaths) {
				expect(path).toMatch(/^[a-z0-9-]+\.webp$/);
			}
		});

		it('does not declare a per-asset provider; Cloudinary is the global image host', () => {
			for (const spec of ABRIL_ASSET_SPECS) {
				expect('provider' in spec).toBe(false);
			}
		});

		it('uses B&W cake portrait for Family, sharp dress portrait for Thank-you, and unique assets in Gallery', () => {
			const semanticMap = buildSemanticAssetMap(abrilInvitation);
			const content = buildAbrilPublishedContent(semanticMap) as any;

			// Family section receives the editorial B&W cake portrait
			expect(content.family.featuredImage.assetId).toContain('gallery-02-bw-cake');

			// Thank-you section receives the sharp white dress portrait
			expect(content.thankYou.image.assetId).toContain('gallery-05-white-dress');

			// Gallery item 2 receives the tiara/gloves portrait
			expect(content.gallery.items[1].image.assetId).toContain('family-portrait');
			expect(content.gallery.items[1].alt).toBe('Abril Michelle luciendo tiara y guantes');

			// Check all 5 gallery items use unique assets
			const galleryAssetIds = content.gallery.items.map((item: any) => item.image.assetId);
			const uniqueGalleryAssetIds = new Set(galleryAssetIds);
			expect(uniqueGalleryAssetIds.size).toBe(5);
			expect(galleryAssetIds[2]).toContain('thank-you-confetti');

			// Family image and Thank-you image are NOT duplicated in Gallery
			expect(galleryAssetIds).not.toContain(content.family.featuredImage.assetId);
			expect(galleryAssetIds).not.toContain(content.thankYou.image.assetId);
		});

		it('keeps family, gallery, interludes, and thank-you assets in the inventory without role collisions', () => {
			const keys = ABRIL_ASSET_SPECS.map((s) => s.key);
			expect(keys).toContain('family-portrait');
			expect(keys).toContain('interlude-crown');
			expect(keys).toContain('interlude-palace');
			expect(keys).toContain('thank-you-confetti');
			expect(keys).toContain('gallery-01-candles');
			expect(keys).toContain('gallery-02-bw-cake');
			expect(keys).toContain('gallery-03-seated-balloons');
			expect(keys).toContain('gallery-04-white-suit');
			expect(keys).toContain('gallery-05-white-dress');
		});
	});

	describe('Cloudinary SDK Interaction & Reconciliation Mock Tests', () => {
		beforeEach(() => {
			process.env.CLOUDINARY_CLOUD_NAME = 'mock-cloud';
			process.env.CLOUDINARY_API_KEY = 'mock-key';
			process.env.CLOUDINARY_API_SECRET = 'mock-secret';
		});

		it('reuses existing Cloudinary asset when SHA-256 context matches', async () => {
			const dummyBytes = new Uint8Array([1, 2, 3]);
			const dummySha = createHash('sha256').update(dummyBytes).digest('hex');

			const cloudinaryModule = await import('cloudinary');
			const resourceSpy = jest.spyOn(cloudinaryModule.v2.api, 'resource').mockImplementation(async () => ({
				public_id: `preview/xv/abril-michelle-becerra-rea/assets/hero-desktop-${dummySha.slice(0, 12)}`,
				version: 1,
				secure_url: undefined,
				width: 1000,
				height: 1000,
				bytes: 3,
				format: 'webp',
				resource_type: 'image',
				created_at: '2026-07-25T00:00:00Z',
				context: { custom: { sha256: dummySha } },
			}));

			try {
				const res = await uploadOrReconcileCloudinaryAsset({
					targetEnvironment: 'preview',
					eventType: 'xv',
					slug: 'abril-michelle-becerra-rea',
					key: 'hero-desktop',
					displayName: 'Hero Desktop',
					alt: 'Hero Alt',
					bytes: dummyBytes,
					sha256: dummySha,
					mimeType: 'image/webp',
					dryRun: false,
				});

				expect(res.action).toBe('REUSE');
				expect(res.secureUrl).toBe(
					'https://res.cloudinary.com/mock-cloud/image/upload/v1/' +
						res.publicId +
						'.webp',
				);
			} finally {
				resourceSpy.mockRestore();
			}
		});

		it('throws collision error when existing Cloudinary asset has conflicting SHA-256 context', async () => {
			const dummyBytes = new Uint8Array([1, 2, 3]);
			const dummySha = createHash('sha256').update(dummyBytes).digest('hex');

			const cloudinaryModule = await import('cloudinary');
			const resourceSpy = jest.spyOn(cloudinaryModule.v2.api, 'resource').mockImplementation(async () => ({
				public_id: `preview/xv/abril-michelle-becerra-rea/assets/hero-desktop-${dummySha.slice(0, 12)}`,
				version: 1,
				secure_url: undefined,
				width: 1000,
				height: 1000,
				bytes: 3,
				format: 'webp',
				resource_type: 'image',
				created_at: '2026-07-25T00:00:00Z',
				context: { custom: { sha256: 'different-sha256-hash' } },
			}));

			try {
				await expect(
					uploadOrReconcileCloudinaryAsset({
						targetEnvironment: 'preview',
						eventType: 'xv',
						slug: 'abril-michelle-becerra-rea',
						key: 'hero-desktop',
						displayName: 'Hero Desktop',
						alt: 'Hero Alt',
						bytes: dummyBytes,
						sha256: dummySha,
						mimeType: 'image/webp',
						dryRun: false,
					}),
				).rejects.toThrow('Cloudinary public ID collision detected');
			} finally {
				resourceSpy.mockRestore();
			}
		});

		it('verifies the delivered binary instead of trusting provider SHA context alone', async () => {
			const canonical = await sharp({
				create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
			}).webp().toBuffer();
			const sha256 = createHash('sha256').update(canonical).digest('hex');
			const publicId = 'preview/xv/example/assets/hero-' + sha256.slice(0, 12);
			const cloudinaryModule = await import('cloudinary');
			const resourceSpy = jest.spyOn(cloudinaryModule.v2.api, 'resource').mockResolvedValue({
				public_id: publicId,
				version: 1,
				width: 2,
				height: 2,
				bytes: canonical.length,
				format: 'webp',
				resource_type: 'image',
				created_at: '2026-09-01T00:00:00Z',
				context: { custom: { sha256 } },
			} as never);
			const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
				ok: true,
				status: 200,
				headers: { get: () => 'image/webp' },
				arrayBuffer: async () => Uint8Array.from(canonical).buffer,
			} as unknown as Response);
			try {
				await expect(verifyCloudinaryAsset({
					publicId, sha256, mimeType: 'image/webp', width: 2, height: 2,
				})).resolves.toMatchObject({ publicId, sha256 });
				fetchSpy.mockResolvedValue({
					ok: true,
					status: 200,
					headers: { get: () => 'image/webp' },
					arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
				} as unknown as Response);
				await expect(verifyCloudinaryAsset({
					publicId, sha256, mimeType: 'image/webp', width: 2, height: 2,
				})).rejects.toThrow('delivered binary SHA-256');
			} finally {
				resourceSpy.mockRestore();
				fetchSpy.mockRestore();
			}
		});
		it('rejects a preserved asset when provider metadata or delivery no longer matches', async () => {
			const sha256 = createHash('sha256').update('canonical').digest('hex');
			const cloudinaryModule = await import('cloudinary');
			const resourceSpy = jest.spyOn(cloudinaryModule.v2.api, 'resource').mockResolvedValue({
				public_id: 'xv/valentina-hernandez/assets/hero-test',
				version: 1,
				secure_url:
					'https://res.cloudinary.com/mock-cloud/image/upload/v1/xv/valentina-hernandez/assets/hero-test.webp',
				width: 1000,
				height: 1200,
				bytes: 100,
				format: 'webp',
				resource_type: 'image',
				created_at: '2026-09-01T00:00:00Z',
				context: { custom: { sha256 } },
			} as never);
			const fetchSpy = jest
				.spyOn(global, 'fetch')
				.mockResolvedValue(new Response('', { status: 404 }));

			try {
				await expect(
					verifyCloudinaryAsset({
						publicId: 'xv/valentina-hernandez/assets/hero-test',
						sha256,
						mimeType: 'image/webp',
						width: 1000,
						height: 1200,
					}),
				).rejects.toThrow('delivery failed (HTTP 404)');
			} finally {
				resourceSpy.mockRestore();
				fetchSpy.mockRestore();
			}
		});
	});
});
