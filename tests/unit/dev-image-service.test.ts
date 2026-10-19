import { readFileSync } from 'node:fs';
const transform = jest.fn();
jest.mock('astro/assets/services/sharp', () => ({
	__esModule: true,
	default: { transform, getURL: jest.fn() },
}));

import devImageService from '@/lib/assets/dev-image-service';

const buffer = new Uint8Array();
const config = {} as Parameters<typeof devImageService.transform>[2];
const logger = {} as Parameters<typeof devImageService.transform>[3];

describe('dev image service', () => {
	beforeEach(() => transform.mockReset());

	// Cloudflare Images scales down within the box; sharp would crop without an explicit fit.
	it('scales down within a width and height box like the hosted runtime', async () => {
		await devImageService.transform(
			buffer,
			{ src: 'a.webp', width: 400, height: 400 },
			config,
			logger,
		);
		expect(transform).toHaveBeenCalledWith(
			buffer,
			{ src: 'a.webp', width: 400, height: 400, fit: 'scale-down' },
			config,
			logger,
		);
	});

	it('keeps an explicit fit and width-only requests unchanged', async () => {
		const cover = { src: 'a.webp', width: 400, height: 400, fit: 'cover' };
		const widthOnly = { src: 'a.webp', width: 640 };
		await devImageService.transform(buffer, cover, config, logger);
		await devImageService.transform(buffer, widthOnly, config, logger);
		expect(transform).toHaveBeenNthCalledWith(1, buffer, cover, config, logger);
		expect(transform).toHaveBeenNthCalledWith(2, buffer, widthOnly, config, logger);
	});

	it('is wired into astro dev only', () => {
		const source = readFileSync('astro.config.mjs', 'utf8');
		expect(source).toMatch(
			/isCloudflareBuild\s*\?\s*\{\}\s*:\s*\{ service: \{ entrypoint: '\.\/src\/lib\/assets\/dev-image-service\.ts' \} \}/,
		);
	});
});
