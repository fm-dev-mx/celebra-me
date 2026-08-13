import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
	{ name: 'mobile', width: 360, height: 800 },
	{ name: 'desktop', width: 1440, height: 900 },
] as const;

async function stylesheetHrefs(page: Page): Promise<string[]> {
	return page
		.locator('link[rel="stylesheet"]')
		.evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
}

test.describe('P0 structural variants render through the live invitation route', () => {
	for (const viewport of VIEWPORTS) {
		test(`renders the celestial program and editorial thank-you at ${viewport.name}`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			const response = await page.goto('/xv/demo-xv-xareni-profile?skipEnvelope=true', {
				waitUntil: 'networkidle',
			});
			expect(response?.status()).toBe(200);

			const itinerary = page.locator('#itinerary');
			await expect(itinerary).toHaveAttribute('data-structural-variant', 'timeline-paper');
			await expect(itinerary.locator('.itinerary__program')).toBeVisible();
			await expect(itinerary.locator('.itinerary__program-row')).toHaveCount(5);
			await expect(itinerary.locator('.itinerary__items-wrapper')).toHaveCount(0);

			const thankYou = page.locator('#thank-you-section');
			await expect(thankYou).toHaveAttribute(
				'data-structural-variant',
				'editorial-back-cover',
			);
			await expect(thankYou.locator('.thank-you-editorial')).toBeVisible();
			await expect(thankYou.locator('.thank-you-content')).toHaveCount(0);

			const stylesheets = (await stylesheetHrefs(page)).join('\n');
			expect(stylesheets).toMatch(/celestial-blue/);
			expect(stylesheets).toMatch(/timeline-paper/);
			expect(stylesheets).toMatch(/index-choreography/);
			expect(stylesheets).not.toMatch(/editorial-ledger|split-cover/);
		});
	}

	test('keeps a standard invitation on the standard renderer and avoids unrelated bundles', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const response = await page.goto('/xv/demo-xv-jewelry-box?skipEnvelope=true', {
			waitUntil: 'networkidle',
		});
		expect(response?.status()).toBe(200);

		const itinerary = page.locator('#itinerary');
		await expect(itinerary).toHaveAttribute('data-structural-variant', 'standard');
		await expect(itinerary.locator('.itinerary__items-wrapper')).toBeVisible();
		await expect(itinerary.locator('.itinerary__program')).toHaveCount(0);

		const thankYou = page.locator('#thank-you-section');
		await expect(thankYou).toHaveAttribute('data-structural-variant', 'standard');
		await expect(thankYou.locator('.thank-you-content')).toBeVisible();
		await expect(thankYou.locator('.thank-you-editorial')).toHaveCount(0);

		const stylesheets = (await stylesheetHrefs(page)).join('\n');
		expect(stylesheets).toMatch(/jewelry-box/);
		expect(stylesheets).not.toMatch(/timeline-paper|index-choreography|editorial-ledger/);
	});
});
