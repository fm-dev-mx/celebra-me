import sharp from 'sharp';
import { Blob as NodeBlob } from 'node:buffer';
import {
	normalizeInvitationImage,
	MAX_OUTPUT_BYTES,
	MAX_OUTPUT_DIMENSION,
	ROLE_AWARE_ASSET_POLICY_VERSION,
} from '@/lib/intake/services/asset-policy';

async function imageBlob(
	format: 'jpeg' | 'png' | 'webp',
	width = 1600,
	height = 1000,
): Promise<Blob> {
	const data = await sharp({
		create: { width, height, channels: 3, background: '#b68b73' },
	})
		.toFormat(format)
		.toBuffer();
	return new NodeBlob([Uint8Array.from(data).buffer], {
		type: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
	}) as Blob;
}

async function patternedImageBlob(width = 1400, height = 1000): Promise<Blob> {
	const pixels = Buffer.alloc(width * height * 3);
	let seed = 0x12345678;
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const index = (y * width + x) * 3;
			seed = (seed * 1664525 + 1013904223) >>> 0;
			const noise = (seed >>> 24) % 32;
			pixels[index] = (x * 255) / width + noise;
			pixels[index + 1] = (y * 255) / height + noise;
			pixels[index + 2] = ((x + y) * 255) / (width + height) + noise;
		}
	}
	const data = await sharp(pixels, { raw: { width, height, channels: 3 } })
		.jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
		.toBuffer();
	return new NodeBlob([Uint8Array.from(data)], { type: 'image/jpeg' }) as Blob;
}

describe('invitation asset delivery policy', () => {
	it('rejects unsupported declared types', async () => {
		await expect(
			normalizeInvitationImage(await imageBlob('png'), 'image/gif'),
		).rejects.toMatchObject({ status: 422, code: 'validation_error' });
	});

	it('decodes and normalizes a valid image to bounded WebP output', async () => {
		const result = await normalizeInvitationImage(
			await imageBlob('jpeg', 4000, 3000),
			'image/jpeg',
		);

		expect(result.mimeType).toBe('image/webp');
		expect(result.width).toBeLessThanOrEqual(MAX_OUTPUT_DIMENSION);
		expect(result.height).toBeLessThanOrEqual(MAX_OUTPUT_DIMENSION);
		expect(result.fileSize).toBeLessThanOrEqual(MAX_OUTPUT_BYTES);
		expect(result.validationVersion).toBe(1);
	});

	it('uses role budget and dimension reduction for a gallery image', async () => {
		const result = await normalizeInvitationImage(
			await patternedImageBlob(),
			'image/jpeg',
			'gallery',
		);

		expect(result.fileSize).toBeLessThanOrEqual(180 * 1024);
		expect(result.width).toBeLessThan(1000);
		expect(result.height).toBeLessThan(1000);
		expect(result.validationVersion).toBe(ROLE_AWARE_ASSET_POLICY_VERSION);
	});

	it('rejects role assets that cannot meet the budget within the quality floor', async () => {
		const pixels = Buffer.alloc(1000 * 1000 * 3);
		let seed = 0x12345678;
		for (let index = 0; index < pixels.length; index += 1) {
			seed = (seed * 1664525 + 1013904223) >>> 0;
			pixels[index] = seed >>> 24;
		}
		const data = await sharp(pixels, { raw: { width: 1000, height: 1000, channels: 3 } })
			.jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
			.toBuffer();

		await expect(
			normalizeInvitationImage(
				new NodeBlob([Uint8Array.from(data)], { type: 'image/jpeg' }) as Blob,
				'image/jpeg',
				'gallery',
			),
		).rejects.toMatchObject({
			status: 422,
			code: 'validation_error',
			details: { reason: 'asset_role_weight_exceeded', role: 'gallery' },
		});
	}, 15000);

	it('rejects corrupt bytes', async () => {
		await expect(
			normalizeInvitationImage(
				new NodeBlob(['not-an-image'], { type: 'image/jpeg' }) as Blob,
				'image/jpeg',
			),
		).rejects.toMatchObject({ status: 422, code: 'validation_error' });
	});

	it('rejects MIME/content mismatch', async () => {
		await expect(
			normalizeInvitationImage(await imageBlob('png'), 'image/jpeg'),
		).rejects.toMatchObject({
			status: 422,
			code: 'validation_error',
			details: { declaredMimeType: 'image/jpeg', detectedMimeType: 'image/png' },
		});
	});

	it('rejects oversized input bytes before decoding', async () => {
		await expect(
			normalizeInvitationImage(
				new NodeBlob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: 'image/png' }) as Blob,
				'image/png',
			),
		).rejects.toMatchObject({ status: 422, code: 'validation_error' });
	});

	it('rejects undersized dimensions', async () => {
		await expect(
			normalizeInvitationImage(await imageBlob('webp', 320, 320), 'image/webp'),
		).rejects.toMatchObject({
			status: 422,
			code: 'validation_error',
		});
	});
});
