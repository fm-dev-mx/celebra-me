/**
 * @jest-environment node
 */
import sharp from 'sharp';
import { createCloudflareImageTransformer } from '@/lib/images/cloudflare-image-transformer';
import { createFakeImagesBinding } from './fake-images-binding';

const LIMITS = { limitInputPixels: 50_000_000 };
const PROVENANCE = {
	exif: { artist: 'Celebra-me', copyright: 'Vista previa', description: 'ref abcdef123456' },
	xmp: '<x:xmpmeta xmlns:x="adobe:ns:meta/"><dc:source>celebra-me-preview:abcdef123456</dc:source></x:xmpmeta>',
};

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

	describe('watermarked rendering', () => {
		it('keeps the photo size, marks it and embeds provenance', async () => {
			const binding = createFakeImagesBinding();
			const transformer = createCloudflareImageTransformer(binding);
			const source = await photo(1066, 1600);

			const marked = await transformer.renderMarked({
				bytes: source,
				...LIMITS,
				format: 'webp',
				quality: 84,
				provenance: PROVENANCE,
			});

			const meta = await sharp(marked.data).metadata();
			expect([marked.width, marked.height]).toEqual([1066, 1600]);
			expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1066, 1600]);
			expect(meta.xmp?.toString('utf8')).toContain('celebra-me-preview:abcdef123456');
			expect(meta.exif?.toString('utf8')).toContain('Celebra-me');
			const stats = await sharp(marked.data).stats();
			const flat = await sharp(source).stats();
			// A flat source gains light and dark strokes: its channel spread grows.
			expect(stats.channels[0].stdev).toBeGreaterThan(flat.channels[0].stdev + 1);
		});

		it('crops the social card and never exceeds ten transforms in one call', async () => {
			const binding = createFakeImagesBinding();
			const transformer = createCloudflareImageTransformer(binding);

			const marked = await transformer.renderMarked({
				bytes: await photo(2160, 3840),
				...LIMITS,
				crop: { width: 1200, height: 630 },
				format: 'jpeg',
				quality: 80,
				provenance: PROVENANCE,
			});

			const meta = await sharp(marked.data).metadata();
			expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1200, 630]);
			expect(binding.calls.length).toBeGreaterThan(1);
			for (const call of binding.calls) expect(call.transforms).toBeLessThanOrEqual(10);
		});

		it('draws many marks through full-size overlays and a single base call', async () => {
			const binding = createFakeImagesBinding();
			const transformer = createCloudflareImageTransformer(binding);

			await transformer.renderMarked({
				bytes: await photo(2000, 3000),
				...LIMITS,
				format: 'webp',
				quality: 84,
				provenance: PROVENANCE,
			});

			// Mark scaling, then overlays built in parallel, then the final base call.
			const final = binding.calls.at(-1)!;
			expect(final.format).toBe('image/webp');
			expect(final.transforms).toBeGreaterThan(1);
			expect(
				binding.calls.filter((call) => call.format === 'image/png').length,
			).toBeGreaterThan(2);
		});

		it('merges overlays when a very large image needs more than ten', async () => {
			const binding = createFakeImagesBinding();
			const transformer = createCloudflareImageTransformer(binding);

			const marked = await transformer.renderMarked({
				bytes: await photo(7600, 4200),
				limitInputPixels: 50_000_000,
				format: 'webp',
				quality: 60,
				provenance: PROVENANCE,
			});

			expect([marked.width, marked.height]).toEqual([7600, 4200]);
			for (const call of binding.calls) expect(call.transforms).toBeLessThanOrEqual(10);
		}, 60_000);

		it('reuses the scaled mark across renders of the same width', async () => {
			const binding = createFakeImagesBinding();
			const transformer = createCloudflareImageTransformer(binding);
			const request = {
				bytes: await photo(1000, 700),
				...LIMITS,
				format: 'webp' as const,
				quality: 84,
				provenance: PROVENANCE,
			};

			await transformer.renderMarked(request);
			const callsAfterFirst = binding.calls.length;
			await transformer.renderMarked(request);

			// The second render skips only the mark scaling call.
			expect(binding.calls.length - callsAfterFirst).toBe(callsAfterFirst - 1);
		});

		it('propagates binding failures', async () => {
			const binding = createFakeImagesBinding();
			const transformer = createCloudflareImageTransformer(binding);
			await expect(
				transformer.renderMarked({
					bytes: new Uint8Array([1, 2, 3]),
					...LIMITS,
					format: 'webp',
					quality: 84,
					provenance: PROVENANCE,
				}),
			).rejects.toThrow();
		});
	});
});
