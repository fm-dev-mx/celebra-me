import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';
import * as sass from 'sass-embedded';

/**
 * Non-persisted portability harness.
 *
 * Uses existing demo-xv-jewelry-box content (non-Romina / non-Alba theme jewelry-box).
 * Applies only the canonical structuralVariant marker + compiled canonical structural CSS.
 * Does not mutate provisioned invitations or demo JSON on disk.
 */

const DEMO_PATH = '/xv/demo-xv-jewelry-box?skipEnvelope=true';
const ARTIFACT_ROOT = path.join(
	process.cwd(),
	'output',
	'playwright',
	'structural-variant-portability',
);

function compileStructuralPartial(relativePath: string): string {
	const file = path.resolve(process.cwd(), relativePath);
	return sass.compile(file, { loadPaths: [process.cwd()] }).css;
}

async function openDemoWithoutEnvelope(page: Page) {
	await page.addInitScript(() => {
		window.localStorage.setItem('envelope-opened-demo-xv-jewelry-box', 'true');
	});

	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') {
			errors.push(message.text());
		}
	});

	await page.goto(DEMO_PATH, { waitUntil: 'domcontentloaded' });
	return errors;
}

async function assertNoOriginStylesheets(page: Page) {
	const hrefs = await page
		.locator('link[rel="stylesheet"]')
		.evaluateAll((nodes) =>
			nodes.map((node) => (node as HTMLLinkElement).href).filter(Boolean),
		);
	expect(hrefs.join('\n')).not.toMatch(/romina-rios-chaparro|alba-rosa-quinonez/i);
}

test.describe('non-origin structural variant portability', () => {
	test('Hero split-cover renders on jewelry-box demo without Romina profile', async ({
		page,
	}) => {
		const errors = await openDemoWithoutEnvelope(page);
		await assertNoOriginStylesheets(page);

		const hero = page.locator('#inicio.invitation-hero, .invitation-hero').first();
		await expect(hero).toBeVisible();

		await hero.evaluate((el) => {
			el.setAttribute('data-variant', 'split-cover');
		});
		await page.addStyleTag({
			content: compileStructuralPartial('src/styles/themes/sections/hero/_split-cover.scss'),
		});

		await expect(hero).toHaveAttribute('data-variant', 'split-cover');

		// Desktop (≥ lg / 992px): independent type plane + contained lateral image.
		await page.setViewportSize({ width: 1280, height: 800 });
		const desktop = await hero.evaluate((el) => {
			const styles = window.getComputedStyle(el);
			const img = el.querySelector('.invitation-hero__background img');
			const content = el.querySelector('.invitation-hero__content');
			if (!(img instanceof HTMLElement) || !(content instanceof HTMLElement)) {
				return null;
			}
			const imgStyles = window.getComputedStyle(img);
			const contentStyles = window.getComputedStyle(content);
			const imgBox = img.getBoundingClientRect();
			const contentBox = content.getBoundingClientRect();
			return {
				background: styles.backgroundColor,
				imgObjectFit: imgStyles.objectFit,
				imgWidth: imgBox.width,
				contentWidth: contentBox.width,
				contentTextAlign: contentStyles.textAlign,
				viewportWidth: window.innerWidth,
			};
		});

		expect(desktop).not.toBeNull();
		expect(desktop!.imgObjectFit).toBe('contain');
		expect(desktop!.imgWidth).toBeGreaterThan(200);
		expect(desktop!.contentWidth).toBeGreaterThan(120);
		expect(desktop!.contentWidth).toBeLessThan(desktop!.viewportWidth * 0.55);
		expect(['left', 'start']).toContain(desktop!.contentTextAlign);

		fs.mkdirSync(path.join(ARTIFACT_ROOT, 'desktop'), { recursive: true });
		await hero.screenshot({
			path: path.join(ARTIFACT_ROOT, 'desktop', 'hero-split-cover.png'),
		});

		// Mobile: composition remains complete (standard stacked hero; no layout crash).
		await page.setViewportSize({ width: 390, height: 844 });
		const mobile = await hero.evaluate((el) => {
			const img = el.querySelector('.invitation-hero__background img');
			const content = el.querySelector('.invitation-hero__content');
			if (!(img instanceof HTMLElement) || !(content instanceof HTMLElement)) {
				return null;
			}
			const imgBox = img.getBoundingClientRect();
			const contentBox = content.getBoundingClientRect();
			return {
				imgVisible: imgBox.width > 0 && imgBox.height > 0,
				contentVisible: contentBox.width > 0 && contentBox.height > 0,
				hasName: Boolean(el.querySelector('.invitation-hero__title, h1')),
			};
		});

		expect(mobile).toEqual({
			imgVisible: true,
			contentVisible: true,
			hasName: true,
		});

		fs.mkdirSync(path.join(ARTIFACT_ROOT, 'mobile'), { recursive: true });
		await hero.screenshot({
			path: path.join(ARTIFACT_ROOT, 'mobile', 'hero-split-cover.png'),
		});

		expect(errors, 'Unexpected page/console errors').toEqual([]);
	});

	test('Location split-map renders on jewelry-box demo without Alba profile', async ({
		page,
	}) => {
		const errors = await openDemoWithoutEnvelope(page);
		await assertNoOriginStylesheets(page);

		const location = page.locator('#event-location');
		await expect(location).toBeVisible();

		await location.evaluate((el) => {
			el.setAttribute('data-variant', 'split-map');
		});
		await page.addStyleTag({
			content: compileStructuralPartial(
				'src/styles/themes/sections/location/_split-map.scss',
			),
		});

		await expect(location).toHaveAttribute('data-variant', 'split-map');
		await expect(location.locator('.event-location__card')).toHaveCount(2);
		await expect(location.locator('.event-location__card-image-outer-frame')).toHaveCount(2);
		await expect(location.locator('.event-location__card-navigation-buttons')).toHaveCount(2);

		// Desktop (≥ 768px): venue content + map/actions as split planes.
		await page.setViewportSize({ width: 1280, height: 800 });
		await location.scrollIntoViewIfNeeded();
		const desktop = await location.evaluate((el) => {
			const card = el.querySelector('.event-location__card');
			if (!(card instanceof HTMLElement)) return null;
			const styles = window.getComputedStyle(card);
			const content = card.querySelector('.event-location__card-content-list');
			const map = card.querySelector('.event-location__card-image-outer-frame');
			const nav = card.querySelector('.event-location__card-navigation-buttons');
			if (
				!(content instanceof HTMLElement) ||
				!(map instanceof HTMLElement) ||
				!(nav instanceof HTMLElement)
			) {
				return null;
			}
			const contentBox = content.getBoundingClientRect();
			const mapBox = map.getBoundingClientRect();
			const navBox = nav.getBoundingClientRect();
			return {
				display: styles.display,
				columns: styles.gridTemplateColumns,
				areas: styles.gridTemplateAreas.replace(/\s+/g, ' ').trim(),
				contentLeft: contentBox.left,
				mapLeft: mapBox.left,
				navTop: navBox.top,
				mapTop: mapBox.top,
				mapWidth: mapBox.width,
				contentWidth: contentBox.width,
			};
		});

		expect(desktop).not.toBeNull();
		expect(desktop!.display).toBe('grid');
		expect(desktop!.columns.split(' ').length).toBeGreaterThanOrEqual(2);
		// Lateral split: map plane sits to the right of venue copy.
		expect(desktop!.mapLeft).toBeGreaterThan(desktop!.contentLeft);
		expect(desktop!.mapWidth).toBeGreaterThan(160);
		expect(desktop!.contentWidth).toBeGreaterThan(120);
		expect(desktop!.mapWidth + desktop!.contentWidth).toBeGreaterThan(400);

		fs.mkdirSync(path.join(ARTIFACT_ROOT, 'desktop'), { recursive: true });
		await location.screenshot({
			path: path.join(ARTIFACT_ROOT, 'desktop', 'location-split-map.png'),
		});

		// Mobile: stacked content → map → actions.
		await page.setViewportSize({ width: 390, height: 844 });
		await location.scrollIntoViewIfNeeded();
		const mobile = await location.evaluate((el) => {
			const card = el.querySelector('.event-location__card');
			if (!(card instanceof HTMLElement)) return null;
			const styles = window.getComputedStyle(card);
			const content = card.querySelector('.event-location__card-content-list');
			const map = card.querySelector('.event-location__card-image-outer-frame');
			const nav = card.querySelector('.event-location__card-navigation-buttons');
			if (
				!(content instanceof HTMLElement) ||
				!(map instanceof HTMLElement) ||
				!(nav instanceof HTMLElement)
			) {
				return null;
			}
			const contentBox = content.getBoundingClientRect();
			const mapBox = map.getBoundingClientRect();
			const navBox = nav.getBoundingClientRect();
			return {
				display: styles.display,
				contentTop: contentBox.top,
				mapTop: mapBox.top,
				navTop: navBox.top,
				allVisible: contentBox.height > 0 && mapBox.height > 0 && navBox.width > 0,
			};
		});

		expect(mobile).not.toBeNull();
		expect(mobile!.display).toBe('flex');
		expect(mobile!.mapTop).toBeGreaterThanOrEqual(mobile!.contentTop - 1);
		expect(mobile!.navTop).toBeGreaterThanOrEqual(mobile!.mapTop - 1);
		expect(mobile!.allVisible).toBe(true);

		fs.mkdirSync(path.join(ARTIFACT_ROOT, 'mobile'), { recursive: true });
		await location.screenshot({
			path: path.join(ARTIFACT_ROOT, 'mobile', 'location-split-map.png'),
		});

		expect(errors, 'Unexpected page/console errors').toEqual([]);
	});
});
