import { expect, test } from '@playwright/test';
import { memoriesGalleryCopy } from '../../src/lib/memories/copy';

/**
 * Shared gallery links are credentials, so every failure is the same 404 with no
 * caching and no indexing. Set MEMORIES_E2E_GALLERY_PATH to a live link
 * (`/r/<slug>/galeria/<token>`) of a space with available files to also check
 * that the gallery renders thumbnails and opens the viewer.
 */

const GALLERY_PATH = process.env.MEMORIES_E2E_GALLERY_PATH ?? '';
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
