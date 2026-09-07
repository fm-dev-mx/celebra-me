import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

for (const viewport of [
	{ width: 390, height: 844 },
	{ width: 1440, height: 900 },
]) {
	test(`original hero bytes survive content resolution at ${viewport.width}px`, async ({
		page,
	}) => {
		await page.setViewportSize(viewport);
		const response = await page.goto(
			'/test/variant?full=1&eventType=bautizo&slug=cesar-ramses',
		);
		expect(response?.ok()).toBe(true);
		const image = page.locator('.invitation-hero__background picture img').first();
		await expect(image).toBeVisible();
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
		const mobile = viewport.width < 992;
		expect(actual.src).toMatch(
			mobile ? /^data:image\/jpeg;base64,/ : /^data:image\/webp;base64,/,
		);
		const bytes = Buffer.from(actual.src.split(',')[1], 'base64');
		const source = readFileSync(
			resolve(
				'src/assets/images/events/cesar-ramses',
				mobile ? 'hero-production.jpg' : 'gallery-02.webp',
			),
		);
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(
			createHash('sha256').update(source).digest('hex'),
		);
		expect([actual.width, actual.height]).toEqual(mobile ? [1234, 1280] : [2400, 1350]);
	});
}

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
