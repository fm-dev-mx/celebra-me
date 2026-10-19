/**
 * @jest-environment node
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import jsQR from 'jsqr';
import sharp from 'sharp';

jest.mock('@/lib/server/deploy-identity', () => ({
	isProductionDeployment: jest.fn(),
}));

import { MEMORIES_PUBLIC_ORIGIN } from '@/lib/memories/contract/private-request';
import { MEMORIES_QR_PARAMS } from '@/lib/memories/qr';
import { buildMemoriesQrDownloadResponse } from '@/lib/memories/server/qr-download';
import { isProductionDeployment } from '@/lib/server/deploy-identity';

/**
 * The printed QR must open the memories page of the environment that issued it: the canonical
 * domain in Production, the serving origin in Preview and local runs.
 */

const mockedIsProduction = isProductionDeployment as jest.Mock;
const PUBLIC_SLUG = 'victoria-y-roberto';
const PREVIEW_ORIGIN = 'https://preview.celebra-me.com';

async function decodeDownloadedQr(response: Response): Promise<string> {
	const svg = await response.text();
	const { data, info } = await sharp(Buffer.from(svg, 'utf8'))
		.resize(MEMORIES_QR_PARAMS.pngSizePx / 4, MEMORIES_QR_PARAMS.pngSizePx / 4, {
			fit: 'fill',
			kernel: 'nearest',
		})
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const code = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
		inversionAttempts: 'dontInvert',
	});
	if (!code?.data) throw new Error('The downloaded QR does not decode.');
	return code.data;
}

describe('memories QR target URL', () => {
	it('encodes the canonical memories page in Production', async () => {
		mockedIsProduction.mockReturnValue(true);
		const target = await decodeDownloadedQr(
			await buildMemoriesQrDownloadResponse({ publicSlug: PUBLIC_SLUG }, PREVIEW_ORIGIN),
		);

		expect(target).toBe(`${MEMORIES_PUBLIC_ORIGIN}/r/${PUBLIC_SLUG}`);
	});

	it('encodes the serving origin outside Production', async () => {
		mockedIsProduction.mockReturnValue(false);
		const target = await decodeDownloadedQr(
			await buildMemoriesQrDownloadResponse({ publicSlug: PUBLIC_SLUG }, PREVIEW_ORIGIN),
		);

		expect(target).toBe(`${PREVIEW_ORIGIN}/r/${PUBLIC_SLUG}`);
	});

	it('points at a route the app serves', async () => {
		mockedIsProduction.mockReturnValue(false);
		const target = new URL(
			await decodeDownloadedQr(
				await buildMemoriesQrDownloadResponse(
					{ publicSlug: PUBLIC_SLUG },
					'http://localhost:4321',
				),
			),
		);
		const [, routeDirectory, slug] = target.pathname.split('/');

		expect(slug).toBe(PUBLIC_SLUG);
		expect(existsSync(join(process.cwd(), 'src/pages', routeDirectory, '[slug].astro'))).toBe(
			true,
		);
	});
});
