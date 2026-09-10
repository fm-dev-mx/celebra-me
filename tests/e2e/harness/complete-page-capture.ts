import type { Page } from '@playwright/test';
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { getOperationalToolbarSelectors } from '../../../scripts/screenshot/utils';

export async function initializeVisualCapture(page: Page): Promise<void> {
	await page.addInitScript(() => {
		Object.assign(window, { __celebraScreenshotMode: 'audit' });
	});
}

export async function captureStablePage(page: Page, fullPage = false): Promise<Buffer> {
	// A 1440px-wide complete page can take 4-5 seconds per PNG before comparison.
	const timeout = fullPage ? 20_000 : 5_000;
	const deadline = Date.now() + timeout;
	let previous = await page.screenshot({ fullPage, animations: 'disabled' });
	while (Date.now() < deadline) {
		await page.waitForTimeout(100);
		const current = await page.screenshot({ fullPage, animations: 'disabled' });
		if (current.equals(previous)) return current;
		const [before, after] = await Promise.all(
			[previous, current].map((image) =>
				sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
			),
		);
		if (
			before.info.width === after.info.width &&
			before.info.height === after.info.height &&
			// Match Playwright's color/antialiasing rules, but allow zero changed pixels.
			pixelmatch(before.data, after.data, undefined, after.info.width, after.info.height, {
				threshold: 0.2,
			}) === 0
		)
			return current;
		previous = current;
	}
	throw new Error(`Page capture did not stabilize within ${timeout / 1000} seconds.`);
}

export async function waitForVisualHydration(page: Page): Promise<void> {
	const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
	await page.waitForFunction(() =>
		Array.from(document.querySelectorAll('astro-island[ssr]')).every(
			(island) => island.getClientRects().length === 0,
		),
	);
	const fields = page.locator('.rsvp__field');
	for (let index = 0; index < (await fields.count()); index++) {
		const field = fields.nth(index);
		if (!(await field.isVisible())) continue;
		await field.scrollIntoViewIfNeeded();
		await page.waitForFunction(
			(element) => {
				for (let node: Element | null = element; node; node = node.parentElement) {
					if (
						node instanceof HTMLElement &&
						node.style.opacity !== '' &&
						Number(node.style.opacity) < 1
					)
						return false;
				}
				return true;
			},
			await field.elementHandle(),
		);
	}
	await page.evaluate(async (position) => {
		window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
		await document.fonts.ready;
		await new Promise<void>((resolve) =>
			requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
		);
	}, scroll);
}

export async function assertNoOperationalTooling(page: Page): Promise<void> {
	const selectors = getOperationalToolbarSelectors();
	const visibleSelector = await page.evaluate((selectorList) => {
		for (const selector of selectorList) {
			const elements = document.querySelectorAll(selector);
			for (const element of elements) {
				const style = getComputedStyle(element);
				if (
					style.display !== 'none' &&
					style.visibility !== 'hidden' &&
					style.opacity !== '0' &&
					element.getClientRects().length > 0
				) {
					return selector;
				}
			}
		}
		return null;
	}, selectors);
	if (visibleSelector) {
		throw new Error('Visible operational tooling: ' + visibleSelector);
	}
}

export async function hideOperationalTooling(page: Page): Promise<void> {
	await page.addStyleTag({
		content: getOperationalToolbarSelectors().join(',') + '{display:none!important}',
	});
}

export async function prepareCompletePage(page: Page): Promise<void> {
	await hideOperationalTooling(page);
	await page.evaluate(async () => {
		await document.fonts.ready;
		// A body scroll container hides most of the document from native full-page capture.
		if (
			document.body.scrollHeight > document.body.clientHeight + 1 &&
			document.documentElement.scrollHeight <= innerHeight + 1
		) {
			document.body.style.height = 'auto';
			document.body.style.maxHeight = 'none';
			document.body.style.overflowY = 'visible';
			document.documentElement.style.overflowY = 'visible';
		}
		for (const image of document.images) image.loading = 'eager';
	});
	const sections = page.locator(
		'[data-section-id], .invitation-section-wrapper[data-section-kind], astro-island, img, footer',
	);
	const sectionCount = await sections.count();
	for (let index = 0; index < sectionCount; index++) {
		if (!(await sections.nth(index).isVisible())) continue;
		await sections.nth(index).scrollIntoViewIfNeeded();
		await page.waitForTimeout(40);
	}
	await waitForVisualHydration(page);
	await page.waitForFunction(() =>
		Array.from(document.images).every(
			(image) => !image.currentSrc || (image.complete && image.naturalWidth > 0),
		),
	);
	await page.evaluate(async () => {
		// Loaded bytes alone do not guarantee that async-decoded images have painted.
		await Promise.all(
			Array.from(document.images)
				.filter((image) => image.currentSrc)
				.map((image) => image.decode()),
		);
		document.body.scrollTop = 0;
		window.scrollTo({ top: 0, behavior: 'instant' });
	});
	await assertNoOperationalTooling(page);
}

export async function assertCompletePageImage(page: Page, image: Buffer): Promise<void> {
	const metadata = await sharp(image).metadata();
	const extent = await page.evaluate(() => {
		const sections = [
			...document.querySelectorAll(
				'[data-section-id], .invitation-section-wrapper[data-section-kind], footer',
			),
		];
		return {
			height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
			lastBottom: Math.max(
				0,
				...sections.map(
					(section) => section.getBoundingClientRect().bottom + window.scrollY,
				),
			),
			viewport: innerHeight,
		};
	});
	if (
		!metadata.height ||
		metadata.height < extent.height - 1 ||
		metadata.height < extent.lastBottom - 1 ||
		(extent.height > extent.viewport && metadata.height <= extent.viewport)
	) {
		throw new Error(
			'Truncated complete-page capture: ' +
				JSON.stringify({ imageHeight: metadata.height, ...extent }),
		);
	}
	await assertNoOperationalTooling(page);
}

export async function captureCompletePage(page: Page): Promise<Buffer> {
	const image = await captureStablePage(page, true);
	await assertCompletePageImage(page, image);
	return image;
}
