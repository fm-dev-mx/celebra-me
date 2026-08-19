/**
 * Local/Preview visual audit for provisioned `/xv/leslie-perez`.
 * Not part of `pnpm test:e2e:ci` (DB-free hermetic suite). Copy and
 * itinerary contracts live in `tests/content/leslie-perez-payload.test.ts`.
 */
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
	{ name: 'mobile-390', width: 390, height: 844 },
	{ name: 'desktop-1024', width: 1024, height: 768 },
	{ name: 'desktop-1280', width: 1280, height: 800 },
	{ name: 'desktop-1440', width: 1440, height: 900 },
	{ name: 'desktop-1920', width: 1920, height: 1080 },
] as const;

test.describe('Leslie Perez final adjustments validation', () => {
	for (const vp of VIEWPORTS) {
		test(`verifies hero, dress code, and zero overflow at ${vp.name} (${vp.width}x${vp.height})`, async ({
			page,
		}) => {
			await page.setViewportSize({ width: vp.width, height: vp.height });
			await page.goto('/xv/leslie-perez?skipEnvelope=true', { waitUntil: 'networkidle' });

			// 1. Verify Hero
			const heroSection = page.locator('#inicio');
			await expect(heroSection).toBeVisible();
			await expect(heroSection.locator('.invitation-hero__title')).toContainText('Leslie');

			// 2. Verify Dress Code indications
			const locationSection = page.locator('#event-location');
			await expect(locationSection).toBeVisible();

			const indicationItems = page.locator('.event-location__indication-item');
			await expect(indicationItems).toHaveCount(2);

			await expect(indicationItems.nth(0)).toContainText('Código de vestimenta: formal.');
			await expect(indicationItems.nth(1)).toContainText(
				'El color azul marino está reservado exclusivamente para la quinceañera.',
			);

			// Verify old individual icons are hidden/removed
			const visibleIcons = page.locator('.event-location__indication-icon:visible');
			await expect(visibleIcons).toHaveCount(0);

			// 3. Verify Program / Itinerary
			const itinerarySection = page.locator('#itinerary');
			await expect(itinerarySection).toBeVisible();

			const itineraryItems = page.locator('.itinerary__item');
			await expect(itineraryItems).toHaveCount(4);

			// Check exact second event text
			const item2 = itineraryItems.nth(1);
			await expect(item2.locator('.itinerary__item-time')).toHaveText('8:00 PM');
			await expect(item2.locator('.itinerary__item-label')).toHaveText(
				'Presentación de la quinceañera',
			);

			// 4. Verify no horizontal overflow
			const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
			const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
			expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

			// Capture targeted screenshots for each viewport after scrolling into view
			await heroSection.scrollIntoViewIfNeeded();
			await page.waitForTimeout(250);
			await heroSection.screenshot({
				path: `screenshots/xv-leslie-perez/validation/hero-${vp.name}.png`,
			});

			await locationSection.scrollIntoViewIfNeeded();
			await page.waitForTimeout(300);
			await locationSection.screenshot({
				path: `screenshots/xv-leslie-perez/validation/location-${vp.name}.png`,
			});

			if (vp.width === 1440) {
				await page.evaluate(() => window.scrollTo(0, 0));
				await page.waitForTimeout(200);
				await page.screenshot({
					path: `screenshots/xv-leslie-perez/validation/full-page-1440.png`,
					fullPage: true,
				});
			}
		});
	}
});
