/**
 * @jest-environment node
 */
import sharp from 'sharp';
import { createCloudflareImageTransformer } from '@/lib/images/cloudflare-image-transformer';
import { createFakeImagesBinding } from './fake-images-binding';

const LIMITS = { limitInputPixels: 50_000_000 };
function photo(width: number, height: number, orientation?: number): Promise<Buffer> {
	const image = sharp({
		create: { width, height, channels: 3, background: { r: 120, g: 160, b: 200 } },
	});
	return (orientation ? image.withMetadata({ orientation }) : image)
		.jpeg({ quality: 90 })
		.toBuffer();
}

describe('Cloudflare image transformer', () => {
	it('inspects format, oriented size, orientation and frame count', async () => {
		const binding = createFakeImagesBinding();
		const transformer = createCloudflareImageTransformer(binding);

		const info = await transformer.inspect(await photo(1500, 1000, 6), LIMITS);

		expect(info).toEqual({
			mimeType: 'image/jpeg',
			width: 1000,
			height: 1500,
			orientation: 6,
			pages: 1,
		});
	});

	it('refuses inputs above the pixel limit and unreadable bytes', async () => {
		const transformer = createCloudflareImageTransformer(createFakeImagesBinding());
		await expect(
			transformer.inspect(await photo(1000, 1000), { limitInputPixels: 999_999 }),
		).rejects.toThrow('pixel limit');
		await expect(transformer.inspect(new Uint8Array([1, 2, 3]), LIMITS)).rejects.toThrow();
	});

	it('reports unsupported formats as no mime type', async () => {
		const transformer = createCloudflareImageTransformer(createFakeImagesBinding());
		const gif = await sharp({
			create: { width: 8, height: 8, channels: 3, background: '#fff' },
		})
			.gif()
			.toBuffer();
		expect((await transformer.inspect(gif, LIMITS)).mimeType).toBeUndefined();
	});

	it('detects a truncated payload when asked to decode', async () => {
		const transformer = createCloudflareImageTransformer(createFakeImagesBinding());
		const source = await photo(800, 600);
		await expect(transformer.assertDecodable(source, LIMITS)).resolves.toBeUndefined();
		await expect(
			transformer.assertDecodable(source.subarray(0, 300), LIMITS),
		).rejects.toThrow();
	});

	it('encodes WebP inside the longest side without enlarging', async () => {
		const binding = createFakeImagesBinding();
		const transformer = createCloudflareImageTransformer(binding);

		const big = await transformer.encodeWebp(await photo(3000, 2000), {
			...LIMITS,
			maxDimension: 1200,
			quality: 76,
		});
		const small = await transformer.encodeWebp(await photo(600, 400), {
			...LIMITS,
			maxDimension: 1200,
			quality: 76,
		});

		expect([big.width, big.height]).toEqual([1200, 800]);
		expect([small.width, small.height]).toEqual([600, 400]);
		expect(big.size).toBe(big.data.byteLength);
		expect((await sharp(big.data).metadata()).format).toBe('webp');
		expect(binding.calls[0]).toMatchObject({ format: 'image/webp', quality: 76 });
	});
});
