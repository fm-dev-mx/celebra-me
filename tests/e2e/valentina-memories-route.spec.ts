import { test, expect } from '@playwright/test';
import {
	VALENTINA_MEMORIES_ROUTE_PATH,
	valentinaMemoriesPageCopy,
} from '../../src/data/valentina-memories.data';

test.describe('Valentina Memories temporary route', () => {
	test('serves a database-independent temporary page with Spanish copy and noindex', async ({
		page,
	}) => {
		const response = await page.goto(VALENTINA_MEMORIES_ROUTE_PATH, {
			waitUntil: 'domcontentloaded',
		});

		expect(response?.ok()).toBeTruthy();
		expect(response?.status()).toBe(200);

		await expect(page.locator('h1.status-page__title')).toHaveText(
			valentinaMemoriesPageCopy.heading,
		);
		await expect(page.locator('.status-page__subtitle')).toHaveText(
			valentinaMemoriesPageCopy.subtitle,
		);
		await expect(page.locator('.status-page__description')).toContainText(
			valentinaMemoriesPageCopy.body,
		);

		const robots = page.locator('meta[name="robots"]');
		await expect(robots).toHaveAttribute('content', valentinaMemoriesPageCopy.robots);

		await expect(page.locator('[data-page="valentina-memories"]')).toBeVisible();
		await expect(page.locator('.event-theme-wrapper')).toHaveCount(0);
	});
});
