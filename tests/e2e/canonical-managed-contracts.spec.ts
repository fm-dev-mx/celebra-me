import { expect, test } from '@playwright/test';
import { initializeVisualCapture } from './harness/complete-page-capture';

for (const audit of [false, true]) {
	for (const expired of [false, true]) {
		test(`countdown ${audit ? 'audit' : 'public'} renders ${expired ? 'expired' : 'future'} state`, async ({
			page,
		}) => {
			const now = new Date(expired ? '2026-09-13T00:00:00.000Z' : '2026-09-10T19:37:17.052Z');
			if (audit) await initializeVisualCapture(page, now);
			else await page.clock.setFixedTime(now);
			await page.goto(
				`/xv/abril-michelle-becerra-rea?skipEnvelope=true${audit ? '&screenshot=true&animations=off' : ''}`,
			);
			const timer = page.locator('[data-countdown]');
			const status = page.locator('[data-countdown-status]');
			if (expired) {
				await expect(timer).toBeHidden();
				await expect(status).toBeVisible();
				await expect(status).toHaveText('La celebración ya comenzó');
			} else {
				await expect(timer).toBeVisible();
				await expect(status).toBeHidden();
				if (audit)
					await expect(page.locator('[data-countdown-value="days"]')).toHaveText('45');
			}
		});
	}
}

for (const width of [390, 1440]) {
	test(`Allison keeps its isolated full-bleed hero at ${width}px`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
		await initializeVisualCapture(page);
		await page.goto('/test/variant?full=1&presentation=1&slug=allison-scarlett');
		await page.evaluate(() => document.fonts.ready);
		const hero = page.locator('.ceremonial-portrait-hero');
		const media = hero.locator('.ceremonial-portrait-hero__media');
		await expect(hero).toHaveCSS('display', 'grid');
		await expect(media).toHaveCSS('position', 'absolute');
		await expect(hero.locator('.ceremonial-portrait-hero__side').first()).toBeHidden();
		const bounds = await hero.boundingBox();
		const photo = await media.boundingBox();
		expect(bounds).not.toBeNull();
		expect(photo).not.toBeNull();
		expect(photo!.width).toBeCloseTo(bounds!.width, 0);
		expect(photo!.height).toBeCloseTo(bounds!.height, 0);
		await hero.screenshot({
			path: testInfo.outputPath(`allison-${width}.png`),
			animations: 'disabled',
		});
	});
}

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
