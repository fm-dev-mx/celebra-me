import { test, expect, type Page } from '@playwright/test';
import { buildSync } from 'esbuild';
import { compile } from 'sass';

const css = compile('src/styles/layout/_header-base.scss', { loadPaths: [process.cwd()] }).css;

const script = buildSync({
	stdin: {
		contents: `import { bindHeaderScroll } from './src/lib/dom/header-scroll';
			bindHeaderScroll(document.querySelector('.header-base'));`,
		resolveDir: process.cwd(),
		loader: 'ts',
	},
	bundle: true,
	format: 'iife',
	write: false,
}).outputFiles[0].text;

const markup = `<style>
		*, *::before, *::after { box-sizing: border-box; }
		body { margin: 0; }
		main { height: 6000px; }
		${css}
	</style>
	<header class="header-base header-base--transparent" data-transparent="true"
		data-threshold-shrink="50" data-threshold-hide="100">
		<div class="header-base__container">Celebra-me</div>
	</header>
	<main></main>`;

async function scrollTo(page: Page, y: number) {
	await page.evaluate(async (target) => {
		window.scrollTo({ top: target, behavior: 'instant' });
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	}, y);
}

const isHidden = (page: Page) =>
	page.locator('.header-base').evaluate((el) => el.classList.contains('header-base--hidden'));

test.describe('shared header auto-hide on a phone', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.setContent(markup);
		await page.addScriptTag({ content: script });
	});

	test('keeps a fixed 70px height from the top to scrolled', async ({ page }) => {
		const header = page.locator('.header-base');
		expect((await header.boundingBox())?.height).toBe(70);
		await scrollTo(page, 400);
		expect((await header.boundingBox())?.height).toBe(70);
	});

	test('small back-and-forth scrolling does not toggle the header', async ({ page }) => {
		await scrollTo(page, 1000);
		await scrollTo(page, 1100);
		expect(await isHidden(page)).toBe(true);

		for (let i = 0; i < 10; i += 1) {
			await scrollTo(page, 1097);
			await scrollTo(page, 1100);
			expect(await isHidden(page)).toBe(true);
		}
	});

	test('scrolling up 60px brings the header back', async ({ page }) => {
		await scrollTo(page, 1000);
		await scrollTo(page, 1100);
		await scrollTo(page, 1080);
		expect(await isHidden(page)).toBe(true);
		await scrollTo(page, 1040);
		expect(await isHidden(page)).toBe(false);
		await expect(page.locator(':root')).toHaveCSS('--nav-current-height', '70px');
	});

	test('reaching the end of the page does not bring the header back', async ({ page }) => {
		const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
		await scrollTo(page, maxY - 300);
		await scrollTo(page, maxY);
		expect(await isHidden(page)).toBe(true);
		await scrollTo(page, maxY - 2);
		expect(await isHidden(page)).toBe(true);
	});
});
