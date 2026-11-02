import { test, expect, devices, type CDPSession, type Page } from '@playwright/test';
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
		expect((await header.boundingBox())?.height).toBeCloseTo(70, 1);
		await scrollTo(page, 400);
		expect((await header.boundingBox())?.height).toBeCloseTo(70, 1);
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

// Phones scroll by touch and resize the viewport while the URL bar collapses or re-expands.
// Chromium's mobile emulation drives both: CDP touch events and real viewport resizes.
// CI installs only Chromium, so the iPhone profile reuses its metrics, touch and user agent.
const { defaultBrowserType: _iphoneBrowser, ...iPhone } = devices['iPhone 13'];
const { defaultBrowserType: _pixelBrowser, ...pixel } = devices['Pixel 7'];
const PHONES = [
	{ name: 'iPhone', device: iPhone },
	{ name: 'Pixel', device: pixel },
];

for (const phone of PHONES) {
	test.describe(`shared header auto-hide on a touch ${phone.name}`, () => {
		test.use(phone.device);

		let cdp: CDPSession;
		const urlBar = 56;

		const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
		const frames = (page: Page, count = 2) =>
			page.evaluate(async (n) => {
				for (let i = 0; i < n; i += 1) await new Promise((r) => requestAnimationFrame(r));
			}, count);

		/** Finger drags of at most 400px; positive `dy` moves further down the page. */
		async function touchScroll(page: Page, dy: number) {
			const point = (y: number) => [{ x: 200, y }];
			for (let left = dy; left !== 0;) {
				const drag = Math.sign(left) * Math.min(Math.abs(left), 400);
				let y = drag > 0 ? 550 : 150;
				await cdp.send('Input.dispatchTouchEvent', {
					type: 'touchStart',
					touchPoints: point(y),
				});
				for (let moved = 0; moved !== drag;) {
					const step = Math.sign(drag) * Math.min(Math.abs(drag - moved), 10);
					moved += step;
					y -= step;
					await cdp.send('Input.dispatchTouchEvent', {
						type: 'touchMove',
						touchPoints: point(y),
					});
				}
				await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
				left -= drag;
			}
			await frames(page);
		}

		/** URL bar animation: the viewport height changes in steps over about 250ms. */
		async function animateUrlBar(page: Page, to: number) {
			const from = page.viewportSize()!;
			const steps = 5;
			for (let i = 1; i <= steps; i += 1) {
				const height = Math.round(from.height + ((to - from.height) * i) / steps);
				await page.setViewportSize({ width: from.width, height });
				await page.waitForTimeout(50);
			}
		}

		/** The browser moves the content by the bar height a few frames after the bar settles. */
		async function shiftAfterUrlBar(page: Page) {
			await page.waitForTimeout(100);
			await page.evaluate((dy) => window.scrollBy(0, dy), -urlBar);
			await frames(page);
		}

		test.beforeEach(async ({ page }) => {
			await page.setContent(markup);
			await page.addScriptTag({ content: script });
			cdp = await page.context().newCDPSession(page);
			expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
		});

		test('the content shift after the URL bar re-expands keeps the header hidden', async ({
			page,
		}) => {
			await touchScroll(page, 1500);
			expect(await isHidden(page)).toBe(true);
			const { height } = page.viewportSize()!;

			await animateUrlBar(page, height - urlBar);
			await shiftAfterUrlBar(page);
			expect(await isHidden(page)).toBe(true);
		});

		test('the URL bar collapsing mid-scroll does not bring the header back', async ({
			page,
		}) => {
			await touchScroll(page, 800);
			expect(await isHidden(page)).toBe(true);
			const { height } = page.viewportSize()!;

			const collapse = animateUrlBar(page, height + urlBar);
			await touchScroll(page, 400);
			await collapse;
			await shiftAfterUrlBar(page);
			expect(await isHidden(page)).toBe(true);
		});

		test('a short flick up keeps the header hidden; a long one brings it back', async ({
			page,
		}) => {
			await touchScroll(page, 1500);
			const start = await scrollY(page);
			expect(await isHidden(page)).toBe(true);

			// Touch slop eats part of the drag; the page itself moves past the 48px desktop distance.
			await touchScroll(page, -100);
			expect(start - (await scrollY(page))).toBeGreaterThan(48);
			expect(start - (await scrollY(page))).toBeLessThan(120);
			expect(await isHidden(page)).toBe(true);

			await touchScroll(page, -250);
			expect(await isHidden(page)).toBe(false);
		});
	});
}
