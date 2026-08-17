import { expect, test } from '@playwright/test';

test.describe('canonical managed invitation route contracts', () => {
	test('Alba renders the canonical days-only Countdown and split-map Location', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		const response = await page.goto('/cumple/alba-rosa-quinonez?skipEnvelope=true', {
			waitUntil: 'networkidle',
		});
		expect(response?.status()).toBe(200);

		const countdown = page.locator('[data-countdown]');
		await expect(countdown).toHaveAttribute('data-visible-units', 'days');
		await expect(countdown).toHaveAttribute('data-unit-count', '1');
		await expect(countdown.locator('[data-unit]')).toHaveCount(1);
		await expect(countdown.locator('[data-unit="days"]')).toBeVisible();

		const location = page.locator('#event-location');
		await expect(location).toHaveAttribute('data-variant', 'split-map');
		const mobileLayout = await location.locator('.event-location__card').evaluate((element) => {
			const style = getComputedStyle(element);
			return { display: style.display, flexDirection: style.flexDirection };
		});
		expect(mobileLayout).toEqual({ display: 'flex', flexDirection: 'column' });

		await page.setViewportSize({ width: 1440, height: 900 });
		await page.reload({ waitUntil: 'networkidle' });
		const desktopLayout = await page
			.locator('#event-location .event-location__card')
			.evaluate((element) => {
				const style = getComputedStyle(element);
				return { display: style.display, gridAreas: style.gridTemplateAreas };
			});
		expect(desktopLayout.display).toBe('grid');
		expect(desktopLayout.gridAreas).toContain('content');
		expect(desktopLayout.gridAreas).toContain('map');
	});

	test('Romina renders the canonical split-cover Hero at desktop and mobile', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		const response = await page.goto('/xv/romina-rios-chaparro?skipEnvelope=true', {
			waitUntil: 'networkidle',
		});
		expect(response?.status()).toBe(200);

		const hero = page.locator('#inicio');
		await expect(hero).toHaveAttribute('data-variant', 'split-cover');
		const desktopLayout = await hero
			.locator('.invitation-hero__background img')
			.evaluate((element) => {
				const style = getComputedStyle(element);
				const rect = element.getBoundingClientRect();
				return { objectFit: style.objectFit, width: rect.width, height: rect.height };
			});
		expect(desktopLayout.objectFit).toBe('contain');
		expect(desktopLayout.width).toBeGreaterThan(0);
		expect(desktopLayout.height).toBeGreaterThan(0);

		await page.setViewportSize({ width: 390, height: 844 });
		await expect(hero).toHaveAttribute('data-variant', 'split-cover');
		const mobileObjectFit = await hero
			.locator('.invitation-hero__background img')
			.evaluate((element) => getComputedStyle(element).objectFit);
		expect(mobileObjectFit).toBe('cover');
	});
});
