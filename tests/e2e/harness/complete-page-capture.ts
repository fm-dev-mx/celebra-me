import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { getOperationalToolbarSelectors } from '../../../scripts/screenshot/utils';

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
		'[data-section-id], .invitation-section-wrapper[data-section-kind], footer',
	);
	const sectionCount = await sections.count();
	for (let index = 0; index < sectionCount; index++) {
		if (!(await sections.nth(index).isVisible())) continue;
		await sections.nth(index).scrollIntoViewIfNeeded();
		await page.waitForTimeout(40);
	}
	await page.waitForFunction(() =>
		Array.from(document.images).every(
			(image) => !image.currentSrc || (image.complete && image.naturalWidth > 0),
		),
	);
	await page.evaluate(() => {
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
	const documentHeight = () =>
		page.evaluate(() =>
			Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
		);
	const before = await documentHeight();
	let image = await page.screenshot({ fullPage: true, animations: 'disabled' });
	// Screenshot preparation can settle motion or trigger responsive layout updates.
	// Discard that image once if the document changed; an unstable retry still fails below.
	if ((await documentHeight()) !== before) {
		image = await page.screenshot({ fullPage: true, animations: 'disabled' });
	}
	await assertCompletePageImage(page, image);
	return image;
}
