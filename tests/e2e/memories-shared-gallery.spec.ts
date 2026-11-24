import { expect, test } from '@playwright/test';
import { memoriesGalleryCopy } from '../../src/lib/memories/copy';
import { buildCanonicalGalleryPath } from '../../scripts/playwright/canonical-memories-fixture';

/**
 * Shared gallery links are credentials, so every failure is the same 404 with no
 * caching and no indexing. Under the canonical fixtures the live link is signed
 * with the synthetic share secret of the fixture space and its files are mocked.
 * Set MEMORIES_E2E_GALLERY_PATH to a live link (`/r/<slug>/galeria/<token>`) of a
 * real space to check that one instead.
 */

const LIVE_GALLERY_PATH = process.env.MEMORIES_E2E_GALLERY_PATH ?? '';
const USE_FIXTURES = process.env.PLAYWRIGHT_USE_CANONICAL_FIXTURES === 'true';
const GALLERY_PATH = LIVE_GALLERY_PATH || (USE_FIXTURES ? buildCanonicalGalleryPath() : '');
const PNG_1X1 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
	'base64',
);
const WRONG_TOKEN = 'A'.repeat(43);

test.describe('memories shared gallery: fail closed', () => {
	test('an unknown space answers 404 without caching or indexing', async ({ page }) => {
		const response = await page.goto(`/r/no-such-space-000/galeria/${WRONG_TOKEN}`);
		expect(response?.status()).toBe(404);
		expect(response?.headers()['cache-control']).toContain('no-store');
		expect(response?.headers()['x-robots-tag']).toContain('noindex');
		await expect(
			page.getByRole('heading', { name: memoriesGalleryCopy.unavailableTitle }),
		).toBeVisible();
	});

	test('a malformed token never reaches the gallery API', async ({ request }) => {
		const response = await request.get('/api/memories/no-such-space-000/gallery/short/items');
		expect(response.status()).toBe(404);
	});
});

test.describe('memories shared gallery: live link', () => {
	test.skip(!GALLERY_PATH, 'MEMORIES_E2E_GALLERY_PATH is not configured');

	test('shows thumbnails and opens a read-only viewer', async ({ page }) => {
		if (!LIVE_GALLERY_PATH) {
			// Fixture mode has no database or storage: the gallery API answers from here.
			const [, , slug, , token] = GALLERY_PATH.split('/');
			const itemsPath = `/api/memories/${slug}/gallery/${token}/items`;
			await page.route(
				(url) => url.pathname === itemsPath,
				(route) =>
					route.fulfill({
						json: {
							items: [
								{
									id: '11111111-1111-4111-8111-111111111111',
									mimeType: 'image/png',
									durationSeconds: null,
									caption: '',
									createdAt: new Date().toISOString(),
									hasThumbnail: true,
									uploaderName: 'Invitado E2E',
								},
							],
							nextPage: null,
						},
					}),
			);
			await page.route(
				(url) => url.pathname.startsWith(`${itemsPath}/`),
				(route) => route.fulfill({ status: 200, body: PNG_1X1, contentType: 'image/png' }),
			);
		}
		await page.goto(GALLERY_PATH);
		const tiles = page.locator('.memories-shared-gallery .memories-tile');
		await expect(tiles.first()).toBeVisible();
		await expect(tiles.first().locator('img')).toHaveAttribute('src', /variant=thumb/);

		await tiles.first().click();
		const viewer = page.getByRole('dialog');
		await expect(viewer).toBeVisible();
		await expect(
			viewer.getByRole('link', { name: memoriesGalleryCopy.download }),
		).toHaveAttribute('href', /download=1/);
		await expect(viewer.getByRole('button', { name: /Eliminar|Ocultar/ })).toHaveCount(0);

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
		);
		expect(overflow).toBeLessThanOrEqual(0);
	});
});
