import { expect, test, type Page } from '@playwright/test';

test.describe('Landing page regressions', () => {
	const scrollLandingHeader = async (page: Page) => {
		await page.evaluate(() => window.scrollTo(0, 320));
		await expect
			.poll(async () =>
				page.locator('#home-header').evaluate((element) => {
					return element.classList.contains('header-base--scrolled');
				}),
			)
			.toBe(true);
	};

	test('keeps the correct navigation at mobile and tablet breakpoints', async ({ page }) => {
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 768, height: 1024 },
		]) {
			await page.setViewportSize(viewport);
			await page.goto('/', { waitUntil: 'domcontentloaded' });

			await expect(page.locator('[data-nav-mobile-toggle]')).toBeVisible();
			await expect(page.locator('.header-base__desktop-nav')).toBeHidden();
			await expect(page.locator('.services__card').first()).toBeVisible();
			await expect(page.locator('#nosotros .about-us__content')).toBeVisible();
		}
	});

	test('keeps the desktop navigation visible and readable on desktop', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/', { waitUntil: 'domcontentloaded' });
		await scrollLandingHeader(page);

		await expect(page.locator('.header-base__desktop-nav')).toBeVisible();
		await expect(page.locator('[data-nav-mobile-toggle]')).toBeHidden();

		const navLinkStyles = await page
			.locator('.home-nav__link')
			.first()
			.evaluate((element) => {
				const styles = window.getComputedStyle(element);
				return {
					color: styles.color,
					opacity: styles.opacity,
				};
			});

		const ctaStyles = await page.locator('.home-nav-actions__cta').evaluate((element) => {
			const styles = window.getComputedStyle(element);
			return {
				color: styles.color,
				backgroundColor: styles.backgroundColor,
				opacity: styles.opacity,
			};
		});

		expect(navLinkStyles.opacity).toBe('1');
		expect(navLinkStyles.color).not.toBe('rgba(0, 0, 0, 0)');
		expect(ctaStyles.opacity).toBe('1');
		expect(ctaStyles.color).not.toBe(ctaStyles.backgroundColor);
	});

	test('keeps the FAQ accordion stable while toggling', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		const faqItem = page.locator('.faq-item').first();
		const faqButton = faqItem.locator('.faq-question-btn');
		const faqAnswer = faqItem.locator('.faq-answer-wrapper');

		await faqItem.scrollIntoViewIfNeeded();
		await expect(faqAnswer).toHaveAttribute('hidden', '');

		const closedBox = await faqItem.boundingBox();
		await faqButton.click();
		await expect(faqButton).toHaveAttribute('aria-expanded', 'true');
		await expect(faqAnswer).toHaveAttribute('aria-hidden', 'false');
		await expect(faqItem).toHaveClass(/is-open/);
		await expect(faqAnswer).toBeVisible();

		const openBox = await faqItem.boundingBox();
		await faqButton.click();
		await expect(faqButton).toHaveAttribute('aria-expanded', 'false');
		await expect(faqAnswer).toHaveAttribute('aria-hidden', 'true');
		await expect(faqItem).not.toHaveClass(/is-open/);
		await expect(faqAnswer).toHaveAttribute('hidden', '');
		await expect(faqAnswer).toBeHidden();

		const closedAgainBox = await faqItem.boundingBox();

		expect(closedBox).not.toBeNull();
		expect(openBox).not.toBeNull();
		expect(closedAgainBox).not.toBeNull();

		if (closedBox && openBox && closedAgainBox) {
			expect(openBox.height).toBeGreaterThan(closedBox.height);
			expect(Math.abs(openBox.width - closedBox.width)).toBeLessThan(1);
			expect(Math.abs(closedAgainBox.height - closedBox.height)).toBeLessThan(2);
		}
	});

	test('closes the mobile menu when resizing up to desktop', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/', { waitUntil: 'domcontentloaded' });

		const toggle = page.locator('[data-nav-mobile-toggle]');
		const menu = page.locator('[data-nav-mobile-menu]');
		const overlay = page.locator('[data-nav-mobile-overlay]');

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(menu).toBeVisible();
		await expect(overlay).toBeVisible();

		await page.setViewportSize({ width: 1280, height: 900 });

		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(menu).toBeHidden();
		await expect(overlay).toBeHidden();
		await expect(page.locator('.header-base__desktop-nav')).toBeVisible();
	});
});
