import { test, expect } from '@playwright/test';

test.describe('GA4 Command-Shape Browser Regression Test', () => {
	test.beforeEach(async ({ page }) => {
		// Intercept Google Tag Manager script loader
		await page.route('**/gtag/js?id=*', async (route) => {
			const url = route.request().url();
			const measurementIdFromUrl = new URL(url).searchParams.get('id') || 'G-TEST';

			// Mock loader that strictly inspects window.dataLayer for Arguments command shape
			const mockGtmScript = `
				let isConfigured = false;
				const dl = window.dataLayer || [];
				for (const item of dl) {
					// Verify command is native Arguments object (not standard Array)
					if (Object.prototype.toString.call(item) === '[object Arguments]') {
						const cmd = item[0];
						if (cmd === 'config') {
							const tid = item[1];
							const options = item[2];
							// Validate config command structure and options
							if (tid === '${measurementIdFromUrl}' && options && options.send_page_view === false) {
								isConfigured = true;
							}
						}
					}
				}

				if (isConfigured) {
					window.google_tag_manager = true;
					// Decorate dataLayer items just like real GTM does
					for (let i = 0; i < dl.length; i++) {
						const item = dl[i];
						if (item && typeof item === 'object') {
							item['gtm.uniqueEventId'] = i + 1;
						}
					}
					// Standard native window.gtag definition created by Google tag
					window.gtag = function(cmd, name, params) {
						window.dataLayer.push(arguments);
						if (cmd === 'event' && name === 'page_view') {
							// Trigger fetch collect request
							fetch('https://www.google-analytics.com/g/collect?v=2&tid=' + '${measurementIdFromUrl}' + '&en=page_view', {
								method: 'POST'
							});
						}
					};

					// Emit mock /g/collect request for any already-recorded page_view events
					for (const item of dl) {
						if (Object.prototype.toString.call(item) === '[object Arguments]') {
							if (item[0] === 'event' && item[1] === 'page_view') {
								fetch('https://www.google-analytics.com/g/collect?v=2&tid=' + '${measurementIdFromUrl}' + '&en=page_view', {
									method: 'POST'
								});
							}
						}
					}
				}
			`;
			await route.fulfill({
				status: 200,
				contentType: 'application/javascript',
				body: mockGtmScript,
			});
		});
	});

	test('Scenario A: Persisted analytics consent before page load', async ({ page }) => {
		const collectedRequests: string[] = [];
		const pageErrors: Error[] = [];
		page.on('pageerror', (err) => pageErrors.push(err));

		// Intercept GA collect requests
		await page.route('https://www.google-analytics.com/g/collect*', async (route) => {
			collectedRequests.push(route.request().url());
			await route.fulfill({ status: 204 });
		});

		// Set consent in localStorage before first navigation
		await page.addInitScript(() => {
			window.localStorage.setItem('cm_consent', JSON.stringify({
				necessary: true,
				analytics: true,
				marketing: true,
				updatedAt: new Date().toISOString()
			}));
		});

		// Navigate to home page (will automatically bootstrap and run initGA4 via client.ts)
		await page.goto('/');

		// Wait deterministically for exactly one page_view collect request
		await expect.poll(() => collectedRequests.length).toBe(1);

		// Assertions
		const gtmLoaded = await page.evaluate(() => typeof (window as any).google_tag_manager !== 'undefined');
		expect(gtmLoaded).toBe(true);

		const dataLayer = await page.evaluate(() => window.dataLayer) as any[];
		expect(dataLayer).toBeDefined();

		// GTM-decorated items should contain 'gtm.uniqueEventId'
		const decoratedJs = dataLayer.find((item: any) => item && item['0'] === 'js' && item['gtm.uniqueEventId'] !== undefined);
		expect(decoratedJs).toBeDefined();

		// Verify exactly one collect call was sent
		expect(collectedRequests.length).toBe(1);
		expect(collectedRequests[0]).toContain('en=page_view');
		expect(collectedRequests[0]).toContain('tid=G-TEST');
		expect(pageErrors).toEqual([]);
	});

	test('Scenario B: Consent granted after page load', async ({ page }) => {
		const collectedRequests: string[] = [];
		const pageErrors: Error[] = [];
		page.on('pageerror', (err) => pageErrors.push(err));

		// Intercept GA collect requests
		await page.route('https://www.google-analytics.com/g/collect*', async (route) => {
			collectedRequests.push(route.request().url());
			await route.fulfill({ status: 204 });
		});

		// Clear consent from localStorage before navigation
		await page.addInitScript(() => {
			window.localStorage.removeItem('cm_consent');
		});

		// Navigate to home page
		await page.goto('/');

		// Assert GTM is not loaded yet
		let gtmLoaded = await page.evaluate(() => typeof (window as any).google_tag_manager !== 'undefined');
		expect(gtmLoaded).toBe(false);
		expect(collectedRequests.length).toBe(0);

		// Trigger consent accept via UI click (which triggers consent save and bootstraps GA4)
		const acceptBtn = page.locator('#consent-accept');
		await expect(acceptBtn).toBeVisible();
		await acceptBtn.click();

		// Wait deterministically for exactly one page_view collect request
		await expect.poll(() => collectedRequests.length).toBe(1);

		// Assertions
		gtmLoaded = await page.evaluate(() => typeof (window as any).google_tag_manager !== 'undefined');
		expect(gtmLoaded).toBe(true);

		const dataLayer = await page.evaluate(() => window.dataLayer) as any[];
		expect(dataLayer).toBeDefined();

		// Verify exactly one collect call was sent
		expect(collectedRequests.length).toBe(1);
		expect(collectedRequests[0]).toContain('en=page_view');
		expect(collectedRequests[0]).toContain('tid=G-TEST');
		expect(pageErrors).toEqual([]);
	});
});
