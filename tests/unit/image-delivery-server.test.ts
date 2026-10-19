import type { ImageMetadata } from 'astro';

const getImage = jest.fn();
jest.mock('astro:assets', () => ({ getImage }), { virtual: true });

import { resolveExplicitImageDelivery } from '@/lib/assets/image-delivery.server';

const EXTERNAL_VERSIONED_URL =
	'https://cdn.example.com/demo/image/upload/v1/xv/demo/assets/hero-abc123.webp';
const LOCAL_ASSET = {
	src: '/_astro/hero.abc123.jpg',
	width: 2000,
	height: 2000,
	format: 'jpg',
} as ImageMetadata;

describe('resolveExplicitImageDelivery', () => {
	beforeEach(() => {
		getImage.mockReset();
		getImage.mockResolvedValue({ src: '/_image?optimized' });
	});

	// Production transforms honour width and height exactly; nothing snaps or drops them.
	it('passes the requested width, height, quality and format through unchanged', async () => {
		const src = await resolveExplicitImageDelivery(
			LOCAL_ASSET,
			{ mode: 'optimized', width: 640, height: 800, quality: 77, format: 'webp' },
			{ width: 1200, quality: 80, format: 'webp' },
		);

		expect(src).toBe('/_image?optimized');
		expect(getImage).toHaveBeenCalledWith({
			src: LOCAL_ASSET,
			width: 640,
			height: 800,
			quality: 77,
			format: 'webp',
		});
	});

	it('falls back to the caller defaults and infers the size of a remote source', async () => {
		await resolveExplicitImageDelivery(
			EXTERNAL_VERSIONED_URL,
			{ mode: 'optimized' },
			{ width: 1200, quality: 80, format: 'webp' },
		);

		expect(getImage).toHaveBeenCalledWith({
			src: EXTERNAL_VERSIONED_URL,
			width: 1200,
			inferSize: true,
			quality: 80,
			format: 'webp',
		});
	});

	it('returns the plain source for original delivery without transforming it', async () => {
		const src = await resolveExplicitImageDelivery(
			LOCAL_ASSET,
			{ mode: 'original' },
			{ width: 1200 },
		);

		expect(src).toBe(LOCAL_ASSET.src);
		expect(getImage).not.toHaveBeenCalled();
	});
});
