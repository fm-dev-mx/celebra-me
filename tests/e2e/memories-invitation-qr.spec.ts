import { expect, test } from '@playwright/test';
import jsQR from 'jsqr';
import sharp from 'sharp';

// Decode the actual rendered component, including its downloadable image. No space or upload
// fixture is needed: these tests do not mutate a database or contact an upload Worker.
for (const [name, path] of [
	['jewelry-box', '/test/variant?section=memories&variant=card&preset=jewelry-box'],
	['editorial', '/test/variant?section=memories&variant=card&preset=editorial'],
]) {
	test(`invitation QR encodes the canonical link and the button its path (${name})`, async ({
		page,
	}) => {
		await page.goto(path);
		const section = page.locator('#memories');
		await expect(section).toBeVisible();
		const image = section.locator('.memories-section__qr-image');
		const source = await image.getAttribute('src');
		expect(source).toMatch(/^data:image\/svg\+xml,/);
		const svg = decodeURIComponent(source!.slice(source!.indexOf(',') + 1));
		const { data, info } = await sharp(Buffer.from(svg))
			.resize(448, 448, { kernel: 'nearest' })
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
		const action = section.locator('.memories-section__action');
		const href = (await action.getAttribute('href'))!;
		expect(href).toMatch(/^\/r\/[a-z0-9-]+$/);
		// A printed QR must resolve for years, so it always names the canonical domain.
		expect(decoded?.data).toBe(`https://celebra-me.com${href}`);
		await expect(section.locator('.memories-section__download')).toHaveAttribute(
			'href',
			source!,
		);
	});
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
	// Camila's memories section returns once her Production memory space exists.
	test(`Camila keeps the ceremony readable without overflow (${reducedMotion})`, async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion });
		for (const [width, height] of [
			[360, 640],
			[390, 844],
			[768, 1024],
			[1440, 900],
		]) {
			await page.setViewportSize({ width, height });
			await page.goto('/test/variant?full=1&slug=camila-beltran&eventType=xv&presentation=1');
			await page.evaluate(() => document.fonts.ready);
			const ceremony = page.locator('.event-location__lede');
			await expect(ceremony).toBeVisible();
			await expect(ceremony).toContainText(
				'7:00 p. m. en Salón Áurea · Rev. Enrique Ruelas Carrillo',
			);
			await expect(page.locator('#memories')).toHaveCount(0);
			for (const selector of ['#event-location', '#galeria']) {
				await page.locator(selector).scrollIntoViewIfNeeded();
				expect(
					await page.evaluate(
						() =>
							document.documentElement.scrollWidth -
							document.documentElement.clientWidth,
					),
				).toBeLessThanOrEqual(1);
			}
		}
	});
}
