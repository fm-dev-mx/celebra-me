import { test, expect } from '@playwright/test';
const routes = [
	'/xv/xareni-iyarit',
	'/xv/ayrin-samantha-lerma-castro',
	'/xv/ana-sofia-cota-guillen',
	'/xv/abril-michelle-becerra-rea',
	'/xv/america-johana',
	'/xv/romina-rios-chaparro',
	'/xv/demo-xv-celestial-blue',
];
for (const route of routes) {
	test('release narrow viewport: ' + route, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.setViewportSize({ width: 414, height: 896 });
		const response = await page.goto(route + '?skipEnvelope=true&animations=off', {
			waitUntil: 'load',
		});
		expect(response?.status()).toBe(200);
		await expect(page.locator('.event-theme-wrapper')).toBeVisible();
		await expect
			.poll(() =>
				page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
			)
			.toBe(true);
		const failedImages = await page
			.locator('img')
			.evaluateAll((images) =>
				images
					.filter(
						(image) =>
							image instanceof HTMLImageElement &&
							image.complete &&
							image.currentSrc &&
							image.naturalWidth === 0,
					)
					.map((image) => image.getAttribute('src')),
			);
		expect(failedImages).toEqual([]);
		expect(errors).toEqual([]);
	});
}
