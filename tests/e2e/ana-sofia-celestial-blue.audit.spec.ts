import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
	{ name: '390x844', width: 390, height: 844 },
	{ name: '768x1024', width: 768, height: 1024 },
	{ name: '1440x1200', width: 1440, height: 1200 },
] as const;

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

const ARTIFACT_ROOT = path.resolve(process.cwd(), 'temp', 'ana-sofia-celestial-blue-audit');
const RGB_VALUE_PATTERN = /^rgb\(\d+[\s,]+\d+[\s,]+\d+\)$/;

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
				url.includes('maps.app.goo.gl')
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

async function captureInvitation(page: Page, viewportName: string) {
	const viewportDir = path.join(ARTIFACT_ROOT, viewportName);
	fs.mkdirSync(viewportDir, { recursive: true });

	await page.goto('/xv/ana-sofia-cota-guillen', { waitUntil: 'domcontentloaded' });

	const wrapper = page.locator('.event-theme-wrapper');
	await expect(wrapper).toHaveAttribute('data-event-slug', 'ana-sofia-cota-guillen');
	await expect(wrapper).toHaveAttribute('data-theme-preset', 'celestial-blue');
	await expect(page.locator('.envelope-wrapper')).toBeVisible();

	await page.screenshot({
		path: path.join(viewportDir, '00-envelope-closed.png'),
		fullPage: true,
	});

	await page.getByRole('button', { name: 'Abrir sobre de la invitación' }).click();
	await expect(wrapper).toHaveAttribute('data-reveal-state', 'revealed');
	await page.waitForTimeout(900);

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
