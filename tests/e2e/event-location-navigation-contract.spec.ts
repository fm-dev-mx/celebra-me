import { expect, test } from '@playwright/test';

test.describe('event location navigation contract', () => {
	test('Daniela uses the linked map previews and address copy actions only', async ({ page }) => {
		await page.goto('/boda/daniela-y-martin?skipEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});

		const location = page.locator('#event-location');
		await expect(location).toBeVisible();
		await expect(location.locator('.event-location__card-navigation-buttons')).toHaveCount(0);
		await expect(location.locator('.event-location__nav-button')).toHaveCount(0);
		await expect(location.locator('.event-location__card-map-preview--link')).toHaveCount(2);
		await expect(location.locator('.event-location__card-map-preview-action')).toHaveCount(2);
		await expect(location.locator('.event-location__card-content-copy-button')).toHaveCount(2);
		await expect(location.locator('a[href*="maps.app.goo.gl"]')).toHaveCount(2);
		await expect(location.locator('[data-venue-artwork="church"]')).toHaveCount(1);
		await expect(location.locator('[data-venue-artwork="event-hall"]')).toHaveCount(1);
	});

	test('the existing wedding invitation keeps provider navigation buttons', async ({ page }) => {
		await page.goto('/boda/demo-boda-jewelry-box-wedding?skipEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});

		const location = page.locator('#event-location');
		await expect(location).toBeVisible();
		await expect(location.locator('.event-location__card-navigation-buttons')).toHaveCount(2);
		await expect(location.locator('.event-location__nav-button--maps')).toHaveCount(2);
		await expect(location.locator('.event-location__card-content-copy-button')).toHaveCount(2);
		await expect(location.locator('.event-location__card-map-preview--link')).toHaveCount(0);
	});
});
