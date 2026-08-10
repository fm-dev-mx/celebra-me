import { expect, test } from '@playwright/test';

/**
 * Goal C — Gallery mobileBrowse=rail on magazine-spread (Valentina profile demo).
 * Desktop retains the magazine grid; mobile becomes a horizontal scroll-snap rail.
 */
const DEMO = '/xv/demo-xv-valentina-profile?skipEnvelope=true';

test.describe('Gallery mobile rail presentation', () => {
	test('mobile uses scroll-snap rail without Valentina-only structural CSS ownership', async ({
		page,
	}) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));

		await page.addInitScript(() => {
			window.localStorage.setItem('envelope-opened-demo-xv-valentina-profile', 'true');
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(DEMO, { waitUntil: 'domcontentloaded' });

		const gallery = page.locator('#galeria');
		await expect(gallery).toBeVisible();
		await expect(gallery).toHaveAttribute('data-mobile-browse', 'rail');
		await expect(gallery.locator('.gallery-section__swipe-hint')).toBeVisible();

		const grid = gallery.locator('.gallery-grid');
		const mobile = await grid.evaluate((el) => {
			const styles = window.getComputedStyle(el);
			const first = el.querySelector('.gallery-grid__item');
			const firstBox = first?.getBoundingClientRect();
			return {
				display: styles.display,
				direction: styles.flexDirection,
				overflowX: styles.overflowX,
				snap: styles.scrollSnapType,
				firstWidth: firstBox?.width ?? 0,
				viewportWidth: window.innerWidth,
			};
		});

		expect(mobile.display).toBe('flex');
		expect(mobile.direction).toBe('row');
		expect(mobile.overflowX).toMatch(/auto|scroll/);
		expect(mobile.snap).toContain('mandatory');
		// ~78vw rail card; allow sub-pixel / scrollbar variance.
		expect(mobile.firstWidth).toBeGreaterThan(mobile.viewportWidth * 0.7);
		expect(mobile.firstWidth).toBeLessThan(mobile.viewportWidth * 0.9);

		const hrefs = await page
			.locator('link[rel="stylesheet"]')
			.evaluateAll((nodes) => nodes.map((node) => (node as HTMLLinkElement).href));
		expect(hrefs.join('\n')).toMatch(/editorial-magazine|gallery/i);

		expect(errors).toEqual([]);
	});

	test('desktop restores magazine grid and hides the swipe hint', async ({ page }) => {
		await page.addInitScript(() => {
			window.localStorage.setItem('envelope-opened-demo-xv-valentina-profile', 'true');
		});
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto(DEMO, { waitUntil: 'domcontentloaded' });

		const gallery = page.locator('#galeria');
		await gallery.scrollIntoViewIfNeeded();
		await expect(gallery).toHaveAttribute('data-mobile-browse', 'rail');
		await expect(gallery.locator('.gallery-section__swipe-hint')).toBeHidden();

		const desktop = await gallery.locator('.gallery-grid').evaluate((el) => {
			const styles = window.getComputedStyle(el);
			return {
				display: styles.display,
				columns: styles.gridTemplateColumns,
				snap: styles.scrollSnapType,
				overflowX: styles.overflowX,
			};
		});

		expect(desktop.display).toBe('grid');
		expect(desktop.columns.split(' ').length).toBeGreaterThanOrEqual(12);
		expect(desktop.snap === 'none' || desktop.snap === '').toBe(true);
	});
});
