import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

/**
 * Face-safety contract for /xv/destenid-sofia: no visible copy may overlap the celebrant's
 * face or body on the magazine cover (reveal) or the hero, on any supported viewport. The
 * prayer and closing photographs are stricter: no copy may sit over any part of them.
 *
 * Each photograph declares a forbidden zone in image-relative coordinates (0–1). The spec
 * maps that zone to viewport pixels using the rendered image box, its natural size, and the
 * computed object-fit: cover / object-position, then checks every visible text block.
 */

const ROUTE = '/xv/destenid-sofia';
const ARTIFACT_ROOT = path.resolve(process.cwd(), 'temp', 'destenid-face-safety');
const TOLERANCE_PX = 6;

interface Zone {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

// WA0034 (cover): crown, face, arms, bouquet, and the tulle over the sill.
const COVER_FORBIDDEN: Zone = { x0: 0.09, y0: 0.58, x1: 0.77, y1: 0.9 };
// WA0029 (hero): the whole figure, from the crown down to the bottom of the frame.
const HERO_FORBIDDEN: Zone = { x0: 0, y0: 0.2, x1: 0.7, y1: 1 };

// Collector edition cover (envelope.coverExperience = 'collector').
const COVER_IMAGE = '.ec-book__front img';
const COVER_TEXT = [
	'.ec-face__masthead',
	'.ec-face__rail',
	'.ec-face__kicker',
	'.ec-face__star',
	'.ec-face__teasers',
	'.ec-face__seal',
	'.ec-face__sill',
	'.ec-ribbon-anchor',
	'.ec-hint',
];

const HERO_TEXT = [
	'.invitation-hero__folio-header',
	'.invitation-hero__title',
	'.invitation-hero__deck',
	'.invitation-hero__details',
	'.invitation-hero__credits',
	'.event-header__title',
	'.event-header__actions',
];

// Prayer (family) and closing (thank-you) plates: the whole frame is off-limits to copy.
const PLATES = [
	{
		frame: '.family__media-frame',
		text: ['.family__header', '.family__message', '.family__media'],
	},
	{
		frame: '.thank-you-editorial__media',
		text: ['.thank-you-editorial__copy', '.thank-you-message', '.signature-block'],
	},
];

const viewports = [
	{ width: 320, height: 568 },
	{ width: 360, height: 740 },
	{ width: 390, height: 844 },
	{ width: 430, height: 932 },
	{ width: 768, height: 1024 },
	{ width: 1024, height: 768 },
	{ width: 1280, height: 720 },
	{ width: 1440, height: 900 },
	{ width: 1920, height: 1080 },
	{ width: 844, height: 390 },
];

interface Overlap {
	selector: string;
	text: { x: number; y: number; width: number; height: number };
	zone: { x: number; y: number; width: number; height: number };
}

async function findOverlaps(
	page: Page,
	imageSelector: string,
	zone: Zone,
	textSelectors: string[],
	tolerance: number,
): Promise<{ overlaps: Overlap[]; checked: number }> {
	return page.evaluate(
		({ imageSelector, zone, textSelectors, tolerance }) => {
			const img = document.querySelector<HTMLImageElement>(imageSelector);
			if (!img || !img.naturalWidth) throw new Error(`Image not ready: ${imageSelector}`);

			const box = img.getBoundingClientRect();
			const style = getComputedStyle(img);
			const scale =
				style.objectFit === 'contain'
					? Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight)
					: Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
			const drawnW = img.naturalWidth * scale;
			const drawnH = img.naturalHeight * scale;
			const [posX, posY] = style.objectPosition.split(' ');
			const offset = (pos: string, free: number) =>
				pos.endsWith('%') ? (free * parseFloat(pos)) / 100 : parseFloat(pos);
			const originX = box.x + offset(posX, box.width - drawnW);
			const originY = box.y + offset(posY ?? '50%', box.height - drawnH);

			// Forbidden zone in viewport pixels, clipped to the visible image box.
			const zx0 = Math.max(box.x, originX + zone.x0 * drawnW);
			const zy0 = Math.max(box.y, originY + zone.y0 * drawnH);
			const zx1 = Math.min(box.x + box.width, originX + zone.x1 * drawnW);
			const zy1 = Math.min(box.y + box.height, originY + zone.y1 * drawnH);
			const zoneRect = { x: zx0, y: zy0, width: zx1 - zx0, height: zy1 - zy0 };

			const overlaps: Overlap[] = [];
			let checked = 0;
			for (const selector of textSelectors) {
				for (const el of document.querySelectorAll<HTMLElement>(selector)) {
					const cs = getComputedStyle(el);
					const r = el.getBoundingClientRect();
					if (
						cs.display === 'none' ||
						cs.visibility === 'hidden' ||
						r.width === 0 ||
						r.height === 0
					) {
						continue;
					}
					if (!el.textContent?.trim()) continue;
					checked += 1;
					const intersects =
						r.x + tolerance < zx1 &&
						r.x + r.width - tolerance > zx0 &&
						r.y + tolerance < zy1 &&
						r.y + r.height - tolerance > zy0;
					if (intersects) {
						overlaps.push({
							selector,
							text: { x: r.x, y: r.y, width: r.width, height: r.height },
							zone: zoneRect,
						});
					}
				}
			}
			return { overlaps, checked };
		},
		{ imageSelector, zone, textSelectors, tolerance },
	);
}

async function findPlateOverlaps(
	page: Page,
	frameSelector: string,
	textSelectors: string[],
	tolerance: number,
): Promise<{ overlaps: string[]; checked: number }> {
	return page.evaluate(
		({ frameSelector, textSelectors, tolerance }) => {
			const frame = document.querySelector<HTMLElement>(frameSelector);
			if (!frame) throw new Error(`Plate not found: ${frameSelector}`);
			const f = frame.getBoundingClientRect();
			const overlaps: string[] = [];
			let checked = 0;
			for (const selector of textSelectors) {
				for (const el of document.querySelectorAll<HTMLElement>(selector)) {
					// The figure itself hosts the caption; only its text boxes below the frame count.
					const boxes =
						el.contains(frame) && el !== frame
							? [...el.children].filter((child) => !child.contains(frame))
							: [el];
					for (const box of boxes) {
						const r = box.getBoundingClientRect();
						if (r.width === 0 || r.height === 0) continue;
						checked += 1;
						if (
							r.x + tolerance < f.right &&
							r.right - tolerance > f.x &&
							r.y + tolerance < f.bottom &&
							r.bottom - tolerance > f.y
						) {
							overlaps.push(selector);
						}
					}
				}
			}
			// The figure caption is a pseudo-element: it must start below the frame.
			const media = frame.closest('figure');
			if (media && getComputedStyle(media, '::after').content !== 'none') {
				checked += 1;
				if (media.getBoundingClientRect().bottom - f.bottom < 12)
					overlaps.push('figure::after');
			}
			return { overlaps, checked };
		},
		{ frameSelector, textSelectors, tolerance },
	);
}

async function waitForImage(page: Page, selector: string) {
	await page.waitForFunction((sel) => {
		const img = document.querySelector<HTMLImageElement>(sel);
		return Boolean(img && img.complete && img.naturalWidth > 0);
	}, selector);
	await page.evaluate(() => document.fonts.ready);
}

test.describe('destenid-sofia face safety', () => {
	test.beforeAll(() => {
		fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
	});

	for (const vp of viewports) {
		const prefix = `${vp.width}x${vp.height}`;

		test(`magazine cover keeps copy off the celebrant at ${prefix}`, async ({ page }) => {
			await page.setViewportSize(vp);
			await page.goto(`${ROUTE}?forceEnvelope=true`, { waitUntil: 'networkidle' });
			await expect(page.locator('ds-editorial-cover')).toBeVisible();
			const image = COVER_IMAGE;
			await waitForImage(page, image);
			// Measure the settled composition, after the magazine and ribbon have landed.
			await page.waitForTimeout(2200);

			const { overlaps, checked } = await findOverlaps(
				page,
				image,
				COVER_FORBIDDEN,
				COVER_TEXT,
				TOLERANCE_PX,
			);
			await page.screenshot({ path: path.join(ARTIFACT_ROOT, `${prefix}_cover.png`) });
			expect(checked).toBeGreaterThan(3);
			expect(overlaps).toEqual([]);
		});

		test(`hero keeps copy off the celebrant at ${prefix}`, async ({ page }) => {
			await page.setViewportSize(vp);
			await page.goto(`${ROUTE}?skipEnvelope=true`, { waitUntil: 'networkidle' });
			const image = await page.evaluate(() => {
				const portrait = document.querySelector<HTMLElement>('.invitation-hero__portrait');
				return portrait && getComputedStyle(portrait).display !== 'none'
					? '.invitation-hero__portrait img'
					: '.invitation-hero__background img';
			});
			await waitForImage(page, image);
			// Let the hero entrance settle so measured boxes are final.
			await page.waitForTimeout(1200);

			const { overlaps, checked } = await findOverlaps(
				page,
				image,
				HERO_FORBIDDEN,
				HERO_TEXT,
				TOLERANCE_PX,
			);
			await page.screenshot({ path: path.join(ARTIFACT_ROOT, `${prefix}_hero.png`) });
			expect(checked).toBeGreaterThan(2);
			expect(overlaps).toEqual([]);
		});

		test(`prayer and closing plates keep copy off the photograph at ${prefix}`, async ({
			page,
		}) => {
			await page.setViewportSize(vp);
			await page.goto(`${ROUTE}?skipEnvelope=true`, { waitUntil: 'networkidle' });
			for (const plate of PLATES) {
				await page.locator(plate.frame).scrollIntoViewIfNeeded();
				// Let the plate wipe and signature finish before measuring.
				await page.waitForTimeout(2000);
				const { overlaps, checked } = await findPlateOverlaps(
					page,
					plate.frame,
					plate.text,
					TOLERANCE_PX,
				);
				expect(checked, plate.frame).toBeGreaterThan(1);
				expect(overlaps, plate.frame).toEqual([]);
			}
		});
	}
});
