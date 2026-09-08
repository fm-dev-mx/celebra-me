import { getInvitationDefinition } from '../../scripts/provision/invitations/registry';
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

test('family retains original delivery dimensions through content resolution', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const response = await page.goto(
		'/test/variant?full=1&eventType=primera-comunion&slug=luna-y-estrella',
	);
	expect(response?.ok()).toBe(true);
	const image = page.locator('.family__media img').first();
	await image.scrollIntoViewIfNeeded();
	await expect(image).toHaveAttribute('width', '1664');
	await expect(image).toHaveAttribute('height', '2080');
	await expect
		.poll(() =>
			image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
		)
		.toBe(true);
	const actual = await image.evaluate((node: HTMLImageElement) => ({
		src: node.currentSrc,
		width: node.naturalWidth,
		height: node.naturalHeight,
	}));
	expect(actual.src).toMatch(/^data:image\/webp;base64,/);
	expect([actual.width, actual.height]).toEqual([1664, 2080]);
	const bytes = Buffer.from(actual.src.split(',')[1], 'base64');
	const source = readFileSync(
		resolve('src/assets/images/events/luna-y-estrella-primera-comunion/family.webp'),
	);
	expect(createHash('sha256').update(bytes).digest('hex')).toBe(
		createHash('sha256').update(source).digest('hex'),
	);
});

for (const slug of [
	'america-johana',
	'ana-sofia-cota-guillen',
	'ayrin-samantha-lerma-castro',
	'cesar-ramses',
	'leah-lexa',
	'xareni-iyarit',
	'ximena-meza-trasvina',
]) {
	test(`prepared gallery sources bypass the image service for ${slug}`, async ({ page }) => {
		const response = await page.goto(
			`/test/variant?full=1&eventType=${getInvitationDefinition(slug).eventType}&slug=${slug}`,
		);
		expect(response?.ok()).toBe(true);
		const images = page.locator(
			'.invitation-section-wrapper[data-screenshot-section="gallery"] img:visible',
		);
		expect(await images.count()).toBeGreaterThan(0);
		for (const image of await images.all()) {
			await image.scrollIntoViewIfNeeded();
			await expect
				.poll(() =>
					image.evaluate(
						(node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
					),
				)
				.toBe(true);
			const src = await image.evaluate((node: HTMLImageElement) => node.currentSrc);
			expect(src).toMatch(/^data:image\/webp;base64,/);
		}
	});
}

test('America mobile hero delivers the prepared file without a runtime transformation', async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/test/variant?full=1&eventType=xv&slug=america-johana');
	const image = page.locator('.invitation-hero__background picture img').first();
	await expect
		.poll(() =>
			image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
		)
		.toBe(true);
	const src = await image.evaluate((node: HTMLImageElement) => node.currentSrc);
	expect(src).toMatch(/^data:image\/webp;base64,/);
	const prepared = readFileSync(
		resolve('src/assets/images/events/xv-america-johana/hero-mobile-prepared.webp'),
	);
	expect(Buffer.from(src.split(',')[1], 'base64').equals(prepared)).toBe(true);
});
