/**
 * @jest-environment node
 */
import {
	installImagesBinding,
	resetImagesBindingForTests,
	resolveImageTransformer,
} from '@/lib/images/image-transformer-provider';
import { normalizeInvitationImage } from '@/lib/intake/services/asset-policy';
import sharp from 'sharp';
import { createFakeImagesBinding } from './fake-images-binding';

afterEach(() => {
	resetImagesBindingForTests();
	jest.restoreAllMocks();
});

describe('image transformer selection', () => {
	it('uses sharp when no binding is installed', async () => {
		expect((await resolveImageTransformer()).id).toBe('sharp');
	});

	it('uses the Cloudflare implementation once a Worker env provides IMAGES', async () => {
		expect(installImagesBinding({ IMAGES: createFakeImagesBinding() })).toBe(true);
		expect((await resolveImageTransformer()).id).toBe('cloudflare-images');
	});

	it('ignores an env without a usable binding', async () => {
		expect(installImagesBinding({ IMAGES: 'nope' })).toBe(false);
		expect(installImagesBinding(undefined)).toBe(false);
		expect((await resolveImageTransformer()).id).toBe('sharp');
	});

	it('fails loudly inside Workers when the binding is missing', async () => {
		const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
		Object.defineProperty(globalThis, 'navigator', {
			value: { userAgent: 'Cloudflare-Workers' },
			configurable: true,
		});
		try {
			await expect(resolveImageTransformer()).rejects.toThrow('IMAGES binding');
		} finally {
			if (original) Object.defineProperty(globalThis, 'navigator', original);
			else delete (globalThis as { navigator?: unknown }).navigator;
		}
	});

	it('runs the intake policy end to end through the binding', async () => {
		installImagesBinding({ IMAGES: createFakeImagesBinding() });
		const source = await sharp({
			create: { width: 3200, height: 2000, channels: 3, background: '#b68b73' },
		})
			.jpeg()
			.toBuffer();

		const normalized = await normalizeInvitationImage(
			new Blob([new Uint8Array(source)], { type: 'image/jpeg' }),
			'image/jpeg',
		);

		expect(normalized.mimeType).toBe('image/webp');
		expect([normalized.width, normalized.height]).toEqual([2560, 1600]);
		await expect(
			normalizeInvitationImage(
				new Blob([new Uint8Array(source.subarray(0, 500))], { type: 'image/jpeg' }),
				'image/jpeg',
			),
		).rejects.toMatchObject({ status: 422 });
	});
});
