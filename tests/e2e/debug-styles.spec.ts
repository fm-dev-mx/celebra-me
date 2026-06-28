import { test } from '@playwright/test';

test.skip('Debug gallery styles at 1440x900', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/xv/valentina-hernandez?skipEnvelope=true');
	await page.waitForSelector('[data-gallery-index="0"] img');
	await page.waitForTimeout(1000); // let layout stabilize

	const styles = await page.evaluate(() => {
		const container = document.querySelector('[data-gallery-index="0"]');
		const img = document.querySelector('[data-gallery-index="0"] img');
		if (!container || !img) return null;

		const cStyle = window.getComputedStyle(container);
		const iStyle = window.getComputedStyle(img);

		return {
			container: {
				display: cStyle.display,
				width: cStyle.width,
				height: cStyle.height,
				position: cStyle.position,
				overflow: cStyle.overflow,
				aspectRatio: cStyle.aspectRatio,
			},
			img: {
				width: iStyle.width,
				height: iStyle.height,
				objectFit: iStyle.objectFit,
				objectPosition: iStyle.objectPosition,
				position: iStyle.position,
			},
		};
	});

	console.log('COMPUTED STYLES AT 1440:', JSON.stringify(styles, null, 2));
});
