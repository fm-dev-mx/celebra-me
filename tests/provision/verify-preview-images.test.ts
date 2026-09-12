import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { verifyPublishedImageManifest } from '../../scripts/invitation/verify-preview-images.ts';

describe('read-only published Preview image verification', () => {
	const assetId = 'asset-1';
	const url =
		'https://res.cloudinary.com/demo/image/upload/v1/preview/xv/example/assets/hero-abcd.webp';

	async function fixture() {
		const bytes = await sharp({
			create: { width: 2, height: 2, channels: 3, background: '#fff' },
		})
			.webp()
			.toBuffer();
		const sha256 = createHash('sha256').update(bytes).digest('hex');
		const expected = [{ key: 'hero', sha256, mimeType: 'image/webp', width: 2, height: 2 }];
		const published = {
			content: { hero: { image: { type: 'uploaded', assetId } } },
			assets: [
				{
					id: assetId,
					key: 'hero',
					sha256,
					mimeType: 'image/webp',
					width: 2,
					height: 2,
					url,
				},
			],
		};
		const download = jest.fn(async () => ({
			ok: true,
			status: 200,
			headers: { get: () => 'image/webp' },
			arrayBuffer: async () => Uint8Array.from(bytes).buffer,
		})) as unknown as typeof fetch;
		return { expected, published, download };
	}

	it('accepts one referenced, matching Cloudinary binary', async () => {
		const { expected, published, download } = await fixture();
		expect(await verifyPublishedImageManifest(expected, published, download)).toEqual([]);
		expect(download).toHaveBeenCalledTimes(1);
	});

	it('reports missing references, metadata drift, and delivery failure without a URL', async () => {
		const { expected, published } = await fixture();
		published.content = { hero: { image: { type: 'uploaded', assetId: 'different' } } };
		published.assets[0]!.sha256 = 'incorrect';
		const download = jest.fn(
			async () => new Response(null, { status: 404 }),
		) as unknown as typeof fetch;
		expect(await verifyPublishedImageManifest(expected, published, download)).toEqual([
			'hero: HTTP 404',
			'hero: asset is not referenced by published content',
			'hero: persisted SHA-256 mismatch',
		]);
	});

	it('rejects a non-Cloudinary URL before any download', async () => {
		const { expected, published, download } = await fixture();
		published.assets[0]!.url = 'https://example.test/private?token=secret';
		expect(await verifyPublishedImageManifest(expected, published, download)).toEqual([
			'hero: invalid Cloudinary delivery URL',
		]);
		expect(download).not.toHaveBeenCalled();
	});
});
