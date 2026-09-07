import { observeVersionedLocalAsset } from '../../scripts/provision/apply-local-invitation';
import { createHash } from 'node:crypto';
import { cesarInvitation } from '../../scripts/provision/invitations/cesar-ramses';
import { buildCloudinaryDeliveryUrl } from '@/lib/intake/services/cloudinary-assets';
import { ImageDeliverySchema } from '@/lib/assets/image-delivery';
import { AssetSchema } from '@/lib/schemas/content/shared.schema';
import { shouldOptimizeThroughVercelImage } from '@/lib/assets/vercel-image-policy';
import {
	materializeAssetReferences,
	semanticAssetRef,
} from '../../scripts/provision/normalized-invitation-release';
import {
	rewriteUploadedAssetReferences,
	areEquivalentAssetRepresentations,
	hashManagedInvitationContent,
} from '../../scripts/provision/promotion-comparison';
import {
	localManagedStoragePath,
	isAcceptableLocalFinalAssetRow,
} from '../../scripts/provision/local-final-asset-verification';

const delivery = {
	mode: 'optimized',
	width: 1200,
	height: 1600,
	quality: 84,
	format: 'webp',
} as const;
const sha256 = 'a'.repeat(64);

test('validates optional delivery on existing asset references', () => {
	expect(AssetSchema.parse({ type: 'internal', key: 'hero', delivery }).delivery).toEqual(
		delivery,
	);
	expect(AssetSchema.parse({ type: 'internal', key: 'hero' }).delivery).toBeUndefined();
	for (const invalid of [
		{ mode: 'other' },
		{ ...delivery, width: 0 },
		{ ...delivery, quality: 101 },
		{ mode: 'original', quality: 84 },
	]) {
		expect(ImageDeliverySchema.safeParse(invalid).success).toBe(false);
	}
});

test('materialization and semantic comparison retain delivery intent', () => {
	const source = { ...semanticAssetRef('hero'), delivery };
	const ref = {
		type: 'uploaded' as const,
		assetId: 'local-id',
		src: 'https://example.com/hero.webp',
	};
	const frozen = materializeAssetReferences(source, { hero: ref });
	expect(frozen).toEqual({ ...ref, delivery });
	const rewritten = rewriteUploadedAssetReferences(frozen, new Map([['local-id', 'hero']]));
	expect(rewritten).toEqual({ ok: true, value: source });
	expect(hashManagedInvitationContent(source)).not.toEqual(
		hashManagedInvitationContent({ ...source, delivery: { ...delivery, quality: 80 } }),
	);
	expect(areEquivalentAssetRepresentations(source, 'hero')).toBe(false);
});

test('explicit original delivery is independent of storage provider', () => {
	for (const url of [
		'https://res.cloudinary.com/demo/image/upload/v1/hero.webp',
		'http://127.0.0.1:54321/storage/v1/object/public/images/hero.webp',
	]) {
		expect(shouldOptimizeThroughVercelImage(url, { mode: 'original' })).toBe(false);
	}
});

test('explicit optimization requires immutable local objects and keeps legacy cache protection', () => {
	const base = 'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/';
	const mutable = base + localManagedStoragePath('demo', 'hero');
	const immutable = base + localManagedStoragePath('demo', 'hero', sha256);
	expect(shouldOptimizeThroughVercelImage(mutable)).toBe(false);
	expect(() => shouldOptimizeThroughVercelImage(mutable, delivery)).toThrow('versioned');
	expect(shouldOptimizeThroughVercelImage(immutable, delivery)).toBe(true);
	expect(
		isAcceptableLocalFinalAssetRow({
			provider: 'supabase',
			secureUrl: immutable,
			sha256,
			expectedSha256: sha256,
			slug: 'demo',
			key: 'hero',
		}),
	).toBe(true);
	expect(
		isAcceptableLocalFinalAssetRow({
			provider: 'supabase',
			secureUrl: immutable,
			sha256,
			expectedSha256: 'b'.repeat(64),
			slug: 'demo',
			key: 'hero',
		}),
	).toBe(false);
});

test('keeps original JPEG paths format-correct and content-addressed', () => {
	const path = localManagedStoragePath('demo', 'hero', sha256, 'image/jpeg');
	expect(path).toBe(`managed/demo/hero-${sha256}.jpg`);
	expect(
		isAcceptableLocalFinalAssetRow({
			provider: 'supabase',
			secureUrl: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${path}`,
			sha256,
			expectedSha256: sha256,
			mimeType: 'image/jpeg',
			slug: 'demo',
			key: 'hero',
		}),
	).toBe(true);
});

test('canonical publication applies delivery to concrete environment references', () => {
	const assets = Object.fromEntries(
		cesarInvitation.assets.map((asset) => [
			asset.key,
			{
				type: 'uploaded' as const,
				assetId: asset.key,
				src: `https://example.com/${asset.key}`,
			},
		]),
	);
	const content = cesarInvitation.buildPublishedContent(assets);
	expect(content.hero).toMatchObject({
		backgroundImage: { delivery: { mode: 'original', width: 2400, height: 1350 } },
		backgroundImageMobile: { delivery: { mode: 'original', width: 1234, height: 1280 } },
	});
	expect(assets.hero).not.toHaveProperty('delivery');
});
test('hosted delivery preserves the original format instead of requesting an implicit WebP conversion', () => {
	expect(buildCloudinaryDeliveryUrl('demo', 'hero', 'image/jpeg')).toBe(
		'https://res.cloudinary.com/demo/image/upload/v1/hero.jpg',
	);
	expect(buildCloudinaryDeliveryUrl('demo', 'hero')).toBe(
		'https://res.cloudinary.com/demo/image/upload/v1/hero.webp',
	);
});

test('versioned Storage observation fails closed on access failures and byte collisions', async () => {
	const response = (status: number, body: string) => async () =>
		({
			ok: status === 200,
			status,
			text: async () => body,
			arrayBuffer: async () => Uint8Array.from(Buffer.from(body)).buffer,
		}) as Response;
	const url =
		'http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/managed/demo/hero.webp';
	await expect(
		observeVersionedLocalAsset(url, sha256, response(404, 'not found') as typeof fetch),
	).resolves.toMatchObject({ present: false });
	await expect(
		observeVersionedLocalAsset(url, sha256, response(403, 'denied') as typeof fetch),
	).rejects.toThrow('HTTP 403');
	await expect(
		observeVersionedLocalAsset(url, sha256, response(200, 'changed') as typeof fetch),
	).rejects.toThrow('collision');
	const digest = createHash('sha256').update('same bytes').digest('hex');
	await expect(
		observeVersionedLocalAsset(url, digest, response(200, 'same bytes') as typeof fetch),
	).resolves.toMatchObject({ present: true, sha256: digest });
});
