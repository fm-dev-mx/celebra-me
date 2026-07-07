import { chromium, type Browser, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const targetPath = '/xv/america-bautista?screenshot=1&reveal=open&skipEnvelope=true&animations=off';
const outputDir = path.resolve('screenshots/america-bautista-hero');

const viewports = [
	{ name: 'mobile-narrow', width: 360, height: 640 },
	{ name: 'iphone-se', width: 375, height: 667 },
	{ name: 'mobile-standard', width: 390, height: 844 },
	{ name: 'mobile-large', width: 430, height: 932 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'desktop', width: 1440, height: 900 },
] as const;

async function captureViewport(browser: Browser, viewport: (typeof viewports)[number]) {
	const page: Page = await browser.newPage({
		viewport: { width: viewport.width, height: viewport.height },
		deviceScaleFactor: 1,
	});
	const consoleMessages: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error' || message.type() === 'warning') {
			consoleMessages.push(`${message.type()}: ${message.text()}`);
		}
	});

	await page.goto(new URL(targetPath, baseUrl).toString(), { waitUntil: 'networkidle' });
	await page.locator('ds-editorial-cover, ds-envelope-reveal').evaluateAll((elements) => {
		for (const element of elements) {
			if (element instanceof HTMLElement) {
				element.hidden = true;
				element.style.display = 'none';
			}
		}
	});
	await page.locator('.event-theme-wrapper').evaluate((element) => {
		if (element instanceof HTMLElement) {
			element.dataset.revealState = 'revealed';
		}
	});
	await page.locator('.invitation-hero').waitFor({ state: 'visible' });

	const fileName = `${viewport.width}x${viewport.height}-${viewport.name}.png`;
	const filePath = path.join(outputDir, fileName);
	await page.screenshot({ path: filePath, fullPage: false });

	const titleBox = await page.locator('.invitation-hero__title').boundingBox();
	const detailsBox = await page.locator('.invitation-hero__details').boundingBox();
	const scrollIndicatorCount = await page.locator('.invitation-hero__scroll-indicator:visible').count();
	const dividerCount = await page.locator('.invitation-hero__divider:visible').count();

	await page.close();

	return {
		viewport: `${viewport.width}x${viewport.height}`,
		filePath,
		titleBox,
		detailsBox,
		scrollIndicatorCount,
		dividerCount,
		consoleMessages,
	};
}

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
try {
	const results = [];
	for (const viewport of viewports) {
		results.push(await captureViewport(browser, viewport));
	}

	console.info(JSON.stringify(results, null, 2));
} finally {
	await browser.close();
}
