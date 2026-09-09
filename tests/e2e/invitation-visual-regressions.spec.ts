import sharp from 'sharp';
import { test, expect } from '@playwright/test';
import { auditCriticalLayout } from './harness/critical-layout-audit';
import {
	prepareCompletePage,
	captureCompletePage,
	assertCompletePageImage,
	assertNoOperationalTooling,
} from './harness/complete-page-capture';

for (const slug of ['romina-rios-chaparro', 'valentina-hernandez', 'ximena-meza-trasvina']) {
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 414, height: 896 },
		{ width: 1440, height: 900 },
	]) {
		test(slug + ' readable cover at ' + viewport.width, async ({ page }) => {
			await page.setViewportSize(viewport);
			const response = await page.goto(
				'/xv/' + slug + '?skipEnvelope=true&screenshot=true&animations=off',
			);
			expect(response?.status()).toBe(200);
			await expect(page.locator('.invitation-hero__title')).toBeVisible();
			await page.evaluate(() => document.fonts.ready);
			await page.waitForTimeout(500);
			expect(await page.locator('body').evaluate(auditCriticalLayout)).toEqual([]);
			if (slug === 'ximena-meza-trasvina' && viewport.width < 860) {
				const textSpacing = await page
					.locator('.invitation-hero__title')
					.evaluate((title) => {
						const style = getComputedStyle(title);
						const context = document.createElement('canvas').getContext('2d')!;
						context.font = [
							style.fontStyle,
							style.fontWeight,
							style.fontSize,
							style.fontFamily,
						].join(' ');
						const metrics = context.measureText(
							(title.textContent ?? '').toUpperCase(),
						);
						return {
							lineHeight: parseFloat(style.lineHeight),
							inkHeight:
								metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
						};
					});
				expect(textSpacing.lineHeight).toBeGreaterThan(textSpacing.inkHeight);
				const ratios = await page
					.locator('.invitation-hero__details p')
					.evaluateAll((elements) => {
						const luminance = (color: string): number => {
							const channels = color
								.match(/[\d.]+/g)!
								.slice(0, 3)
								.map(Number)
								.map((value) => {
									const c = value / 255;
									return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
								});
							return (
								channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
							);
						};
						return elements.map((element) => {
							const foreground = luminance(getComputedStyle(element).color);
							const background = luminance(
								getComputedStyle(element.parentElement!).backgroundColor,
							);
							return (
								(Math.max(foreground, background) + 0.05) /
								(Math.min(foreground, background) + 0.05)
							);
						});
					});
				expect(ratios.length).toBeGreaterThan(0);
				for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
			}
			const play = page.locator('.music-player__button--play');
			if (await play.count()) {
				const box = await play.boundingBox();
				expect(box?.width).toBeGreaterThanOrEqual(44);
				expect(box?.height).toBeGreaterThanOrEqual(44);
			}
		});
	}
}

test('complete-page capture reaches the footer in a body scroll container', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.setContent(
		'<style>html,body{margin:0;height:100%;overflow:hidden}body{overflow-y:auto}section{height:1800px;background:#123}footer{height:120px;background:#c23}</style><section data-section-id="hero">Inicio</section><footer>Fin</footer><footer hidden>No disponible</footer>',
	);
	const truncated = await page.screenshot();
	await prepareCompletePage(page);
	await expect(assertCompletePageImage(page, truncated)).rejects.toThrow('Truncated');
	const image = await captureCompletePage(page);
	const metadata = await sharp(image).metadata();
	const footerPixel = await sharp(image)
		.extract({ left: 195, top: metadata.height! - 20, width: 1, height: 1 })
		.removeAlpha()
		.raw()
		.toBuffer();
	expect([...footerPixel]).toEqual([204, 34, 51]);
});

test('geometry detects clipped text and title/details overlap across stacking levels', async ({
	page,
}) => {
	await page.setContent(
		'<section class="invitation-hero" style="position:relative;width:160px;overflow:hidden"><div class="invitation-hero__title-wrapper"><h1 class="invitation-hero__title" style="white-space:nowrap">María José Hernández Almaguer</h1></div><div class="invitation-hero__details" style="position:absolute;top:20px;z-index:10">Fecha y lugar</div></section>',
	);
	const issues = await page.locator('body').evaluate(auditCriticalLayout);
	expect(issues).toContain('Critical name exceeds its content area');
	expect(issues).toContain('Critical name clipped by ancestor');
	expect(issues).toContain('Title/details overlap');
});

test('operational tooling fails capture validation without hiding product controls', async ({
	page,
}) => {
	await page.setContent(
		'<astro-dev-toolbar style="display:block;width:100px;height:30px">Tools</astro-dev-toolbar><button class="music-player__button--play">Música</button><footer>Fin</footer>',
	);
	await expect(assertNoOperationalTooling(page)).rejects.toThrow('Visible operational tooling');
	await prepareCompletePage(page);
	await expect(page.locator('.music-player__button--play')).toBeVisible();
	await assertNoOperationalTooling(page);
});

for (const variant of ['split-cover', 'editorial-cover', 'standard']) {
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 414, height: 896 },
		{ width: 1440, height: 900 },
	]) {
		test('long accented name: ' + variant + ' at ' + viewport.width, async ({ page }) => {
			await page.setViewportSize(viewport);
			await page.goto(
				'/test/variant?section=hero&variant=' +
					variant +
					'&preset=premiere-floral&longContent=1',
			);
			await page.evaluate(() => document.fonts.ready);
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await expect(page.locator('.invitation-hero__title')).toBeVisible();
			await expect(page.locator('.invitation-hero__title')).toContainText(/maría/i);
			expect(await page.locator('body').evaluate(auditCriticalLayout)).toEqual([]);
		});
	}
}

test('complete-page capture settles a growing footer before measuring the image', async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.setContent(
		'<style>body{margin:0}section{height:1800px}footer{height:120px;background:#c23}</style><section data-section-id="hero">Inicio</section><footer>Fin</footer>',
	);
	await prepareCompletePage(page);
	await page.locator('footer').evaluate((footer) =>
		footer.animate([{ height: '120px' }, { height: '240px' }], {
			duration: 30000,
			fill: 'forwards',
		}),
	);
	const image = await captureCompletePage(page);
	expect((await sharp(image).metadata()).height).toBe(2040);
	const footerPixel = await sharp(image)
		.extract({ left: 195, top: 2020, width: 1, height: 1 })
		.removeAlpha()
		.raw()
		.toBuffer();
	expect([...footerPixel]).toEqual([204, 34, 51]);
});

test('complete-page capture rejects a document that keeps growing during capture', async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.setContent('<style>body{margin:0}footer{height:1800px}</style><footer>Fin</footer>');
	const screenshot = page.screenshot.bind(page);
	let attempts = 0;
	page.screenshot = async (options) => {
		attempts++;
		const image = await screenshot(options);
		await page.locator('footer').evaluate((footer) => {
			footer.style.height = footer.getBoundingClientRect().height + 100 + 'px';
		});
		return image;
	};
	await expect(captureCompletePage(page)).rejects.toThrow('Truncated complete-page capture');
	expect(attempts).toBe(2);
});
