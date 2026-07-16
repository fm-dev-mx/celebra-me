import { expect, test } from '@playwright/test';

const ROUTE = '/xv/demo-xv-jewelry-box';

test.describe('public invitation progressive visibility', () => {
	test.describe('without JavaScript', () => {
		test.use({ javaScriptEnabled: false });

		test('provides an envelope escape path and keeps the complete invitation reachable', async ({
			page,
		}) => {
			await page.goto(ROUTE);
			const fallback = page.getByRole('link', { name: 'Continuar a la invitación' });
			await expect(fallback).toBeVisible();
			await fallback.click();

			await expect(page.locator('[data-screenshot="invitation-root"]')).toHaveAttribute(
				'data-reveal-state',
				'revealed',
			);
			for (const selector of [
				'#inicio',
				'.quote-section',
				'#countdown',
				'#event-location',
				'#regalos',
				'#rsvp',
			]) {
				await expect(page.locator(selector).first()).toBeVisible();
			}
		});
	});

	test('fails open when IntersectionObserver is unavailable', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));

		await page.addInitScript(() => {
			Object.defineProperty(window, 'IntersectionObserver', {
				value: undefined,
				configurable: true,
			});
		});
		await page.goto(`${ROUTE}?skipEnvelope=true`);

		for (const selector of [
			'.quote-line',
			'.countdown-section',
			'.gifts-section',
			'.gallery-grid__item',
		]) {
			await expect(page.locator(selector).first()).toBeVisible();
		}

		expect(errors).toEqual([]);
	});

	test('keeps representative sections visible with reduced motion', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto(`${ROUTE}?skipEnvelope=true`);

		for (const selector of [
			'.quote-line',
			'.countdown-section',
			'.invitation-interlude',
			'.gifts-section',
		]) {
			await expect(page.locator(selector).first()).toBeVisible();
		}

		expect(errors).toEqual([]);
	});
});
