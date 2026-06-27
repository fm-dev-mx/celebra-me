import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const ARTIFACT_ROOT = path.resolve(process.cwd(), 'temp', 'editorial-magazine-visual-qa');

test.describe('Editorial Magazine Visual QA', () => {
	test.beforeAll(() => {
		fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
	});

	test('Capture screenshots section-by-section on mobile', async ({ page }) => {
		// Set mobile viewport (iPhone 14 Pro Max equivalent)
		await page.setViewportSize({ width: 430, height: 932 });

		// Navigate to the demo route
		await page.goto('/xv/demo-xv-editorial-magazine', { waitUntil: 'networkidle' });

		// 1. Cover Reveal Screenshot
		await expect(page.locator('ds-editorial-cover')).toBeVisible();
		await page.screenshot({
			path: path.join(ARTIFACT_ROOT, 'cover.png'),
		});

		// Click the cover button to reveal the invitation
		await page.locator('.editorial-cover__cta').click();

		// Wait for cover exit animation to finish — the custom element is either
		// hidden (hidden attribute) or removed from DOM by the reveal logic
		await page.waitForFunction(() => {
			const cover = document.querySelector('ds-editorial-cover');
			return !cover || cover.hasAttribute('hidden');
		});

		// Wait for hero element to stabilize in the layout
		const hero = page.locator('.invitation-hero');
		await expect(hero).toBeVisible();
		await page.waitForTimeout(250);

		// 2. Hero Opener Screenshot
		await page.screenshot({
			path: path.join(ARTIFACT_ROOT, 'hero.png'),
		});

		// Define selectors and target output names for the rest of the flow
		const sections = [
			{ selector: '.personalized-access', name: 'access-pass.png' },
			{ selector: '.family', name: 'family.png' },
			{ selector: '.gallery-section', name: 'gallery.png' },
			{ selector: '.countdown-section', name: 'countdown.png' },
			{ selector: '.event-location', name: 'locations.png' },
			{ selector: '.rsvp-section', name: 'rsvp.png' },
			{ selector: '.gifts-section', name: 'gifts.png' },
			{ selector: '.thank-you-section', name: 'thank-you.png' },
			{ selector: '.invitation-footer', name: 'footer.png' },
		];

		// Iterate through sections, scroll them into view, and take screenshots
		for (const section of sections) {
			const locator = page.locator(section.selector);
			await expect(locator).toBeVisible();
			await locator.scrollIntoViewIfNeeded();

			// Wait a bit for scroll and fade-in animations to stabilize
			await page.waitForTimeout(800);

			await page.screenshot({
				path: path.join(ARTIFACT_ROOT, section.name),
			});
		}
	});
});
