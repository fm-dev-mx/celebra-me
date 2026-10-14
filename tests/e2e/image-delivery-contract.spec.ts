import { getInvitationDefinition } from '../../scripts/provision/invitations/registry';
import { expect, test, type Locator } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

async function loadedImage(image: Locator) {
	await expect
		.poll(() =>
			image.evaluate(
				(element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
			),
		)
		.toBe(true);
	return image.evaluate((element: HTMLImageElement) => ({
		src: element.currentSrc,
		width: element.naturalWidth,
		height: element.naturalHeight,
	}));
}

// norma-hernandez declares every photograph as preserved `original` delivery, and its
// framed-portrait hero uses the same prepared file at every breakpoint.
for (const viewport of [
	{ width: 390, height: 844 },
	{ width: 1440, height: 900 },
]) {
	test(`original hero bytes survive content resolution at ${viewport.width}px`, async ({
		page,
	}) => {
		await page.setViewportSize(viewport);
		const response = await page.goto(
			'/test/variant?full=1&eventType=cumple&slug=norma-hernandez',
		);
		expect(response?.ok()).toBe(true);
		const image = page.locator('.framed-portrait-hero__photograph img').first();
		await expect(image).toBeVisible();
		const actual = await loadedImage(image);
		expect(actual.src).toMatch(/^data:image\/webp;base64,/);
		const bytes = Buffer.from(actual.src.split(',')[1], 'base64');
		const source = readFileSync(
			resolve('src/assets/invitations/norma-hernandez/childhood.webp'),
		);
		expect(sha256(bytes)).toBe(sha256(source));
		expect([actual.width, actual.height]).toEqual([900, 1600]);
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

// demo-xv-celestial-blue declares its family portrait as `original` delivery (1122x1402).
test('family retains original delivery dimensions through content resolution', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const response = await page.goto(
		'/test/variant?full=1&eventType=xv&slug=demo-xv-celestial-blue',
	);
	expect(response?.ok()).toBe(true);
	const image = page.locator('.family__media img').first();
	await image.scrollIntoViewIfNeeded();
	await expect(image).toHaveAttribute('width', '1122');
	await expect(image).toHaveAttribute('height', '1402');
	const actual = await loadedImage(image);
	expect([actual.width, actual.height]).toEqual([1122, 1402]);
	// Original delivery never routes through the runtime image service.
	expect(actual.src).not.toContain('/_image');
	const delivered = await page.request.get(actual.src);
	expect(delivered.ok()).toBe(true);
	const source = readFileSync(
		resolve('src/assets/images/events/demo-xv-celestial-blue/family-group.webp'),
	);
	expect(sha256(await delivered.body())).toBe(sha256(source));
});

// Both definitions declare `original` delivery for every gallery item (norma: preserved webp,
// romina: original jpeg plus one preserved webp).
for (const slug of ['norma-hernandez', 'romina-rios-chaparro']) {
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
			const { src } = await loadedImage(image);
			expect(src).toMatch(/^data:image\/(webp|jpeg);base64,/);
		}
	});
}

test('mobile hero delivers the prepared file without a runtime transformation', async ({
	page,
}) => {
	// romina-rios-chaparro preserves a prepared mobile hero declared as `original` 1280x1920.
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/test/variant?full=1&eventType=xv&slug=romina-rios-chaparro');
	const image = page.locator('.invitation-hero__background picture img').first();
	const actual = await loadedImage(image);
	expect(actual.src).toMatch(/^data:image\/webp;base64,/);
	expect([actual.width, actual.height]).toEqual([1280, 1920]);
	const prepared = readFileSync(
		resolve('src/assets/invitations/romina-rios-chaparro/hero-mobile.webp'),
	);
	expect(Buffer.from(actual.src.split(',')[1], 'base64').equals(prepared)).toBe(true);
});
