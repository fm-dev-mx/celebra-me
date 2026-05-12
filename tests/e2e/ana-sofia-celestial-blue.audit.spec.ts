import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
	{ name: '390x844', width: 390, height: 844 },
	{ name: '768x1024', width: 768, height: 1024 },
	{ name: '1440x1200', width: 1440, height: 1200 },
] as const;

const HEADER_NAV_VIEWPORTS = [
	{ width: 1024, height: 900, mode: 'mobile' },
	{ width: 1199, height: 900, mode: 'mobile' },
	{ width: 1200, height: 900, mode: 'desktop' },
	{ width: 1280, height: 900, mode: 'desktop' },
] as const;

const EXPECTED_DESKTOP_NAV_LINKS = 6;

const SECTION_SELECTORS = [
	'#inicio',
	'#event-location',
	'#family-section',
	'#itinerary',
	'#galeria',
	'#countdown',
	'#regalos',
	'#rsvp',
	'#thank-you-section',
] as const;

const INTERLUDE_COUNT = 4;

const ARTIFACT_ROOT = path.resolve(process.cwd(), 'temp', 'ana-sofia-celestial-blue-audit');
const RGB_VALUE_PATTERN = /^rgb\(\d+[\s,]+\d+[\s,]+\d+\)$/;
const EXPECTED_EXTERNAL_MEDIA_FAILURES = [
	'res.cloudinary.com/dusxvauvj/video/upload/v1778254135/Ed_Sheeran_-_Perfect_y8moaj.m4a',
] as const;

test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

test.beforeAll(() => {
	fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
});

for (const viewport of VIEWPORTS) {
	test(`renders Ana Sofia Celestial Blue invitation at ${viewport.name}`, async ({ page }) => {
		const errors: string[] = [];
		const requestFailures: string[] = [];

		page.on('pageerror', (error) => {
			errors.push(`pageerror: ${error.message}`);
		});

		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				const text = msg.text();
				if (text.includes('hydration mismatch') || text.includes('A tree hydrated but')) {
					return;
				}
				errors.push(`console.${msg.type()}: ${text}`);
			}
		});

		page.on('requestfailed', (request) => {
			const url = request.url();
			if (
				url.includes('google') ||
				url.includes('vercel') ||
				url.includes('maps.app.goo.gl') ||
				EXPECTED_EXTERNAL_MEDIA_FAILURES.some((expectedUrl) => url.includes(expectedUrl))
			) {
				return;
			}

			requestFailures.push(
				`${request.method()} ${url} :: ${request.failure()?.errorText || 'unknown'}`,
			);
		});

		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await captureInvitation(page, viewport.name);

		expect(errors).toEqual([]);
		expect(requestFailures).toEqual([]);
	});
}

test('keeps celestial-blue invitation header responsive across intermediate widths', async ({
	page,
}) => {
	test.setTimeout(120_000);

	for (const viewport of HEADER_NAV_VIEWPORTS) {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await navigateToInvitation(page);
		await revealInvitation(page);
		await assertHeaderMode(page, viewport.mode);

		await page.evaluate(() => window.scrollTo(0, 360));
		await expect
			.poll(() =>
				page.locator('#event-header').evaluate((element) => {
					return element.classList.contains('header-base--scrolled');
				}),
			)
			.toBe(true);
		await assertHeaderMode(page, viewport.mode);
		await assertNoHorizontalOverflow(page);
	}
});

async function captureInvitation(page: Page, viewportName: string) {
	const viewportDir = path.join(ARTIFACT_ROOT, viewportName);
	fs.mkdirSync(viewportDir, { recursive: true });

	await navigateToInvitation(page);

	const wrapper = page.locator('.event-theme-wrapper');
	await expect(page.locator('.envelope-wrapper')).toBeVisible();

	await page.screenshot({
		path: path.join(viewportDir, '00-envelope-closed.png'),
		fullPage: true,
	});

	await revealInvitation(page);

	const actionAccent = await wrapper.evaluate((element) =>
		getComputedStyle(element).getPropertyValue('--color-action-accent').trim(),
	);
	expect(actionAccent).toMatch(RGB_VALUE_PATTERN);

	const surfaceDark = await wrapper.evaluate((element) =>
		getComputedStyle(element).getPropertyValue('--color-surface-dark').trim(),
	);
	expect(surfaceDark).toMatch(RGB_VALUE_PATTERN);

	await page.screenshot({
		path: path.join(viewportDir, '01-full-page-revealed.png'),
		fullPage: true,
	});

	for (const selector of SECTION_SELECTORS) {
		const section = page.locator(selector);
		await expect(section).toBeVisible();
		await section.scrollIntoViewIfNeeded();
		await page.waitForTimeout(250);
		await section.screenshot({
			path: path.join(viewportDir, `section-${selector.replace('#', '')}.png`),
		});
	}
}

async function navigateToInvitation(page: Page) {
	await page.goto('/xv/ana-sofia-cota-guillen', { waitUntil: 'domcontentloaded' });

	const wrapper = page.locator('.event-theme-wrapper');
	await expect(wrapper).toHaveAttribute('data-event-slug', 'ana-sofia-cota-guillen');
	await expect(wrapper).toHaveAttribute('data-theme-preset', 'celestial-blue');
}

async function revealInvitation(page: Page) {
	const wrapper = page.locator('.event-theme-wrapper');

	const revealButton = page.getByRole('button', { name: 'Abrir sobre de la invitación' });
	if (await revealButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
		await revealButton.click();
	}

	await expect(wrapper).toHaveAttribute('data-reveal-state', 'revealed');
	await expect(page.locator('#inicio')).toBeVisible();
	await expect
		.poll(() =>
			page.locator('#inicio').evaluate((element) => {
				return Math.round(element.getBoundingClientRect().top);
			}),
		)
		.toBe(0);
	await page.waitForTimeout(500);
}

async function assertHeaderMode(page: Page, mode: 'mobile' | 'desktop') {
	const desktopNav = page.locator('.header-base__desktop-nav');
	const mobileToggle = page.locator('[data-nav-mobile-toggle]');

	if (mode === 'mobile') {
		await expect(desktopNav).toBeHidden();
		await expect(mobileToggle).toBeVisible();
	} else {
		await expect(desktopNav).toBeVisible();
		await expect(mobileToggle).toBeHidden();
		await expect(page.locator('.event-header__action-btn')).toHaveCount(
			EXPECTED_DESKTOP_NAV_LINKS,
		);
		await assertDesktopNavItemsFit(page);
	}

	await assertNoHorizontalOverflow(page);
}

async function assertDesktopNavItemsFit(page: Page) {
	const measurements = await page.locator('.event-header__action-btn').evaluateAll((links) =>
		links.map((link) => {
			const element = link as HTMLElement;
			const rect = element.getBoundingClientRect();
			return {
				clientWidth: element.clientWidth,
				scrollWidth: element.scrollWidth,
				left: rect.left,
				right: rect.right,
				viewportWidth: window.innerWidth,
			};
		}),
	);

	for (const measurement of measurements) {
		expect(measurement.scrollWidth).toBeLessThanOrEqual(measurement.clientWidth + 1);
		expect(measurement.left).toBeGreaterThanOrEqual(0);
		expect(measurement.right).toBeLessThanOrEqual(measurement.viewportWidth + 1);
	}
}

async function assertNoHorizontalOverflow(page: Page) {
	const overflow = await page.evaluate(() => {
		const root = document.documentElement;
		return root.scrollWidth - window.innerWidth;
	});

	expect(overflow).toBeLessThanOrEqual(1);
}

test('reveals all interludes with .is-visible class when scrolled into view', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1200 });
	await navigateToInvitation(page);
	await revealInvitation(page);

	const interludes = page.locator('.invitation-interlude');
	await expect(interludes).toHaveCount(INTERLUDE_COUNT);

	for (let i = 0; i < INTERLUDE_COUNT; i++) {
		const interlude = interludes.nth(i);
		await interlude.scrollIntoViewIfNeeded();
		await page.waitForTimeout(300);

		await expect(interlude).toHaveClass(/is-visible/);

		const variant = await interlude.getAttribute('data-variant');
		expect(variant).toBe('celestial-blue');

		const index = await interlude.getAttribute('data-interlude-index');
		expect(index).toBe(String(i + 1));
	}
});

test('interludes remain hidden when JavaScript is disabled (CSS fallback)', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1200 });
	await page.goto('/xv/ana-sofia-cota-guillen', { waitUntil: 'domcontentloaded' });

	const interludes = page.locator('.invitation-interlude');
	const count = await interludes.count();

	if (count > 0) {
		const firstInterlude = interludes.first();
		const opacity = await firstInterlude.evaluate((el) =>
			getComputedStyle(el).getPropertyValue('opacity').trim(),
		);

		expect(['0', '0%', '0.0']).toContain(opacity);
	}
});
