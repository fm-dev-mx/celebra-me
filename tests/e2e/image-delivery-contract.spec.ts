import { expect, test } from '@playwright/test';

for (const variant of ['standard', 'editorial-cover']) {
	for (const width of [390, 1440]) {
		test(`explicit optimization survives ${variant} picture selection at ${width}px`, async ({
			page,
		}) => {
			await page.setViewportSize({ width, height: 900 });
			const response = await page.goto(
				`/test/variant?section=hero&variant=${variant}&imageDelivery=optimized`,
			);
			expect(response?.ok()).toBe(true);
			const image = page.locator('.invitation-hero__background picture img').first();
			await expect
				.poll(() =>
					image.evaluate(
						(element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
					),
				)
				.toBe(true);
			const actual = await image.evaluate((element: HTMLImageElement) => ({
				src: element.currentSrc,
				width: element.naturalWidth,
				height: element.naturalHeight,
			}));
			// The synthetic sources are square: optimization preserves their aspect ratio.
			expect([actual.width, actual.height]).toEqual([640, 640]);
			const params = new URL(actual.src).searchParams;
			expect(params.get('q')).toBe('77');
			const delivered = await page.request.get(actual.src);
			expect(delivered.ok()).toBe(true);
			expect(delivered.headers()['content-type']).toContain('image/webp');
		});
	}
}
