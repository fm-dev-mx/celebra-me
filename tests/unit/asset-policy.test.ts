import sharp from 'sharp';
import { Blob as NodeBlob } from 'node:buffer';
import {
	normalizeInvitationImage,
	MAX_OUTPUT_BYTES,
	MAX_OUTPUT_DIMENSION,
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
