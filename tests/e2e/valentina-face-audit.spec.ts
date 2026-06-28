import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const ARTIFACT_ROOT = path.resolve(process.cwd(), 'temp', 'valentina-face-audit');

const viewports = [
	{ width: 360, height: 740 },
	{ width: 390, height: 844 },
	{ width: 430, height: 932 },
	{ width: 768, height: 1024 },
	{ width: 1024, height: 768 },
	{ width: 1366, height: 768 },
	{ width: 1440, height: 900 },
];

test.describe('Valentina Face Audit across Viewports', () => {
	test.beforeAll(() => {
		fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
	});

	for (const vp of viewports) {
		const prefix = `${vp.width}x${vp.height}`;

		// Pass 1: Cover Reveal only
		test(`Audit Cover ${prefix}`, async ({ page }) => {
			await page.setViewportSize({ width: vp.width, height: vp.height });
			await page.goto('/xv/valentina-hernandez', { waitUntil: 'networkidle' });

			const cover = page.locator('ds-editorial-cover');
			await expect(cover).toBeVisible();
			await page.screenshot({
				path: path.join(ARTIFACT_ROOT, `${prefix}_1_cover.png`),
			});
		});

		// Pass 2: Hero & sections (with skipEnvelope)
		test(`Audit Sections ${prefix}`, async ({ page }) => {
			await page.setViewportSize({ width: vp.width, height: vp.height });
			await page.goto('/xv/valentina-hernandez?skipEnvelope=true', {
				waitUntil: 'networkidle',
			});

			// 2. Hero Section
			const hero = page.locator('.invitation-hero');
			await expect(hero).toBeVisible();
			await page.screenshot({
				path: path.join(ARTIFACT_ROOT, `${prefix}_2_hero.png`),
			});

			// 3. Family Section
			const family = page.locator('.family');
			if (await family.isVisible()) {
				await family.scrollIntoViewIfNeeded();
				await page.waitForTimeout(1000); // animation buffer
				await page.screenshot({
					path: path.join(ARTIFACT_ROOT, `${prefix}_3_family.png`),
				});
			}

			// 4. Gallery Section
			const gallery = page.locator('.gallery-section');
			if (await gallery.isVisible()) {
				await gallery.scrollIntoViewIfNeeded();
				await page.waitForTimeout(1000); // animation buffer
				await page.screenshot({
					path: path.join(ARTIFACT_ROOT, `${prefix}_4_gallery.png`),
				});
			}

			// 5. Thank You Section
			const thankYou = page.locator('.thank-you-section');
			if (await thankYou.isVisible()) {
				await thankYou.scrollIntoViewIfNeeded();
				await page.waitForTimeout(1000); // animation buffer
				await page.screenshot({
					path: path.join(ARTIFACT_ROOT, `${prefix}_5_thankyou.png`),
				});
			}
		});
	}
});
