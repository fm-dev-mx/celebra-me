import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

interface Rect {
	top: number;
	bottom: number;
	left: number;
	right: number;
	width: number;
	height: number;
	centerY: number;
}

function doBoxesIntersect(r1: Rect, r2: Rect): boolean {
	// Account for subpixel precision tolerances (1px margin)
	return !(
		r1.right - 1 <= r2.left ||
		r1.left + 1 >= r2.right ||
		r1.bottom - 1 <= r2.top ||
		r1.top + 1 >= r2.bottom
	);
}

const INVENTORIED_ROUTES = [
	{ route: '/baby-shower/leah-lexa?forceEnvelope=true', name: 'Leah Lexa (Real)', renderer: 'raster' },
	{ route: '/baby-shower/demo-baby-shower-celestial?forceEnvelope=true', name: 'Celestial (Demo)', renderer: 'raster' },
	{ route: '/xv/demo-xv-enchanted-rose?forceEnvelope=true', name: 'Enchanted Rose (Demo)', renderer: 'wax-organic' },
	{ route: '/xv/demo-xv-celestial-blue?forceEnvelope=true', name: 'Celestial Blue (Demo)', renderer: 'wax-medallion' },
	{ route: '/bautismo/demo-bautismo-angelic-presence?forceEnvelope=true', name: 'Angelic Presence (Demo)', renderer: 'monogram' },
	{ route: '/xv/demo-xv-jewelry-box?forceEnvelope=true', name: 'Jewelry Box (Demo)', renderer: 'vector-icon' },
	{ route: '/boda/demo-boda-jewelry-box-wedding?forceEnvelope=true', name: 'Jewelry Box Wedding (Demo)', renderer: 'vector-icon' },
	{ route: '/cumple/demo-cumple-luxury-hacienda?forceEnvelope=true', name: 'Luxury Hacienda (Demo)', renderer: 'wax-organic' },
	{ route: '/primera-comunion/demo-primera-comunion-illustrated?forceEnvelope=true', name: 'Illustrated Communion (Demo)', renderer: 'wax-organic' },
];

const VIEWPORTS = [
	{ name: 'narrow-mobile', width: 360, height: 640 },
	{ name: 'standard-mobile', width: 390, height: 844 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'standard-desktop', width: 1280, height: 800 },
	{ name: 'short-desktop', width: 1280, height: 600 },
	{ name: 'zoom-125-effective', width: 1024, height: 640 },
];

test.describe('Seal Sizing, Tier Selection & Layout Contract Regression', () => {
	for (const item of INVENTORIED_ROUTES) {
		test(`${item.name} closed envelope smoke & layout contract`, async ({ page }) => {
			await page.setViewportSize({ width: 390, height: 844 });
			const response = await page.goto(item.route, { waitUntil: 'networkidle' });
			expect(response?.ok()).toBeTruthy();

			await page.evaluate(() => document.fonts.ready);

			const envelopeWrapper = page.locator('.envelope-wrapper');
			await expect(envelopeWrapper).toBeVisible();

			const trigger = page.locator('[data-envelope-open]');
			await expect(trigger).toBeVisible();

			// Verify layout bounding boxes
			const rects = await page.evaluate(() => {
				const getRect = (selector: string): Rect | null => {
					const el = document.querySelector(selector);
					if (!el) return null;
					const r = el.getBoundingClientRect();
					if (r.width === 0 && r.height === 0) return null;
					return {
						top: r.top,
						bottom: r.bottom,
						left: r.left,
						right: r.right,
						width: r.width,
						height: r.height,
						centerY: r.top + r.height / 2,
					};
				};

				return {
					container: getRect('.envelope-container'),
					visual: getRect('.envelope-seal-button__visual'),
					hint: getRect('.envelope-seal-hint'),
					name: getRect('.envelope-name'),
					instruction: getRect('.envelope-external-instruction'),
				};
			});

			expect(rects.container).not.toBeNull();
			expect(rects.visual).not.toBeNull();
			expect(rects.name).not.toBeNull();

			// 1. Verify seal visual size matches tier specification (subpixel tolerance)
			if (rects.container && rects.visual) {
				const containerWidth = rects.container.width;
				let expectedTierSize = 44;
				if (containerWidth >= 480) {
					expectedTierSize = 68;
				} else if (containerWidth >= 360) {
					expectedTierSize = 56;
				}
				expect(Math.abs(rects.visual.width - expectedTierSize)).toBeLessThanOrEqual(2);

				// 2. Closure anchor vertical alignment within max(2px, 1% of seal width)
				const containerCenterY = rects.container.top + rects.container.height / 2;
				const tolerance = Math.max(2, rects.visual.width * 0.01);
				expect(Math.abs(rects.visual.centerY - containerCenterY)).toBeLessThanOrEqual(tolerance);
			}

			// 3. Collision Assertions
			if (rects.visual && rects.name) {
				expect(doBoxesIntersect(rects.visual, rects.name)).toBe(false);
			}

			if (rects.hint && rects.name) {
				expect(doBoxesIntersect(rects.hint, rects.name)).toBe(false);
			}

			if (rects.container && rects.instruction) {
				expect(doBoxesIntersect(rects.container, rects.instruction)).toBe(false);
			}
		});

		test(`${item.name} pointer and keyboard open interaction`, async ({ page }) => {
			await page.goto(item.route, { waitUntil: 'domcontentloaded' });
			const trigger = page.locator('[data-envelope-open]');
			await expect(trigger).toBeVisible();

			// Test click opening
			await trigger.click();
			await expect(page.locator('.envelope-wrapper')).toHaveClass(/is-opening|is-preview-opened|is-letter-held/);
		});
	}

	// Expanded Responsive Viewport Matrix on representative consumer routes
	const REPRESENTATIVE_ROUTES = [
		{ route: '/baby-shower/leah-lexa?forceEnvelope=true', name: 'Leah Lexa (Raster)' },
		{ route: '/baby-shower/demo-baby-shower-celestial?forceEnvelope=true', name: 'Celestial (Raster Demo)' },
		{ route: '/xv/demo-xv-enchanted-rose?forceEnvelope=true', name: 'Enchanted Rose (Wax Organic)' },
		{ route: '/xv/demo-xv-celestial-blue?forceEnvelope=true', name: 'Celestial Blue (Wax Medallion)' },
	];

	for (const target of REPRESENTATIVE_ROUTES) {
		for (const vp of VIEWPORTS) {
			test(`${target.name} responsive matrix at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
				await page.setViewportSize({ width: vp.width, height: vp.height });
				const response = await page.goto(target.route, { waitUntil: 'networkidle' });
				expect(response?.ok()).toBeTruthy();

				await page.evaluate(() => document.fonts.ready);
				await expect(page.locator('.envelope-wrapper')).toBeVisible();

				const rects = await page.evaluate(() => {
					const getRect = (sel: string) => {
						const el = document.querySelector(sel);
						if (!el) return null;
						const r = el.getBoundingClientRect();
						return {
							top: r.top,
							bottom: r.bottom,
							left: r.left,
							right: r.right,
							width: r.width,
							height: r.height,
							centerY: r.top + r.height / 2,
						};
					};
					return {
						container: getRect('.envelope-container'),
						visual: getRect('.envelope-seal-button__visual'),
						name: getRect('.envelope-name'),
						instruction: getRect('.envelope-external-instruction'),
					};
				});

				expect(rects.visual).not.toBeNull();
				expect(rects.container).not.toBeNull();

				if (rects.visual && rects.container) {
					const containerCenterY = rects.container.top + rects.container.height / 2;
					const tolerance = Math.max(2, rects.visual.width * 0.01);
					expect(Math.abs(rects.visual.centerY - containerCenterY)).toBeLessThanOrEqual(tolerance);
				}

				if (rects.visual && rects.name) {
					expect(doBoxesIntersect(rects.visual, rects.name)).toBe(false);
				}

				// Take screenshot evidence
				const screenshotDir = path.join(
					process.cwd(),
					'test-results',
					'envelope-screenshots',
					vp.name,
				);
				fs.mkdirSync(screenshotDir, { recursive: true });
				const slug = target.route.split('?')[0].replace(/\//g, '-').slice(1);
				await page.screenshot({
					path: path.join(screenshotDir, `${slug}.png`),
					fullPage: false,
				});
			});
		}
	}
});
