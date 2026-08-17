import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const VIEWPORTS = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'desktop', width: 1440, height: 1200 },
] as const;

const ARTIFACT_ROOT = path.resolve(
	process.cwd(),
	'output',
	'playwright',
	'romina-audit',
	new Date().toISOString().replaceAll(':', '-'),
);

test.describe('Romina Ríos Chaparro XV E2E Audit', () => {
	test.beforeAll(() => {
		fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
	});

	for (const viewport of VIEWPORTS) {
		test(`verifies Romina invitation at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
			page,
		}) => {
			const consoleErrors: string[] = [];
			const networkErrors: string[] = [];

			page.on('pageerror', (err) => consoleErrors.push(err.message));
			page.on('console', (msg) => {
				if (msg.type() === 'error') consoleErrors.push(msg.text());
			});
			page.on('requestfailed', (req) => {
				networkErrors.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
			});

			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			const response = await page.goto('/xv/romina-rios-chaparro?skipEnvelope=true', {
				waitUntil: 'networkidle',
			});

			expect(response?.status()).toBe(200);

			// 1. Hero checks
			const hero = page.locator('#inicio, .hero');
			await expect(hero).toBeVisible();
			await expect(hero).toHaveAttribute('data-variant', 'split-cover');

			// 2. Family eyebrow & title
			const familyEyebrow = page.locator('.family__eyebrow');
			await expect(familyEyebrow).toHaveText('Círculo cercano');

			const familyTitle = page.locator('.family__title');
			await expect(familyTitle).toHaveText(
				'Con el amor de mis padres y la compañía de mi familia',
			);

			// 3. Location section and maps
			const locationSection = page.locator('#event-location, .location');
			await expect(locationSection).toBeVisible();

			const mapLinks = page.locator('a[href*="google.com/maps"], a[href*="maps.apple.com"]');
			const count = await mapLinks.count();
			expect(count).toBeGreaterThanOrEqual(2);

			// 4. Console & network error checks
			expect(consoleErrors).toEqual([]);
			expect(networkErrors).toEqual([]);

			// Screenshot for audit evidence
			const screenshotPath = path.join(ARTIFACT_ROOT, `romina-${viewport.name}.png`);
			await page.screenshot({ path: screenshotPath, fullPage: true });
		});
	}
});
