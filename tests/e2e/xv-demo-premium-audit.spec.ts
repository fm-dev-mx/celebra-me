import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
	{ name: '375x812', width: 375, height: 812 },
	{ name: '414x896', width: 414, height: 896 },
	{ name: '390x640', width: 390, height: 640 },
	{ name: '768x1024', width: 768, height: 1024 },
	{ name: '1024x768', width: 1024, height: 768 },
	{ name: '1440x1200', width: 1440, height: 1200 },
] as const;

const SECTION_SELECTORS = [
	'#inicio',
	'#family-section',
	'#galeria',
	'#event-location',
	'#itinerary',
	'#regalos',
	'#rsvp',
	'#thank-you-section',
] as const;

const TIMESTAMP = new Date().toISOString().replaceAll(':', '-');
const ARTIFACT_ROOT = path.resolve(
	process.cwd(),
	'temp',
	'xv-demo-premium-audit',
	process.env.XV_AUDIT_RUN_ID || TIMESTAMP,
);
const CAPTURE_AUDIT_SCREENSHOTS = process.env.XV_AUDIT_SCREENSHOTS === 'true';

test.describe.configure({ mode: 'serial' });
test.setTimeout(60000);

test.beforeAll(() => {
	if (!CAPTURE_AUDIT_SCREENSHOTS) return;

	fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
});

for (const viewport of VIEWPORTS) {
	test(`captures XV demo audit at ${viewport.name}`, async ({ page }) => {
		const errors: string[] = [];
		const requestFailures: string[] = [];

		page.on('pageerror', (error) => {
			errors.push(`pageerror: ${error.message}`);
		});

		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				const text = msg.text();
				if (text.includes('A tree hydrated but') || text.includes('hydration mismatch')) {
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
				url.includes('apple.com') ||
				url.includes('waze.com') ||
				url.includes('maps.app.goo.gl') ||
				url.endsWith('.mp3') ||
				url.endsWith('.MP3') ||
				url.endsWith('.wav')
			) {
				return;
			}

			requestFailures.push(
				`${request.method()} ${url} :: ${request.failure()?.errorText || 'unknown'}`,
			);
		});

		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await captureAuditFlow(page, viewport.name);

		expect(errors, `Unexpected runtime errors for ${viewport.name}`).toEqual([]);
		expect(requestFailures, `Unexpected network failures for ${viewport.name}`).toEqual([]);
	});
}

test('demo reveal ignores persisted opened state by default', async ({ page }) => {
	await page.addInitScript(() => {
		window.localStorage.setItem('envelope-opened-demo-xv', 'true');
	});

	await page.goto('/xv/demo-xv', { waitUntil: 'domcontentloaded' });

	await expect(page.locator('.envelope-wrapper')).toBeVisible();
	await expect(page.locator('.event-theme-wrapper')).toHaveAttribute(
		'data-reveal-state',
		'sealed',
	);
});

test('reduced motion reveal exposes the hero without a staged card transition', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.setViewportSize({ width: 390, height: 640 });
	await page.goto('/xv/demo-xv', { waitUntil: 'domcontentloaded' });

	await page.getByRole('button', { name: 'Abrir sobre de la invitación' }).click();

	await expect(page.locator('.event-theme-wrapper')).toHaveAttribute(
		'data-reveal-state',
		'revealed',
	);
	await expect(page.locator('.envelope-wrapper')).toBeHidden();
	await expect(page.locator('#inicio')).toBeVisible();
});

async function captureAuditFlow(page: Page, viewportName: string) {
	const viewportDir = path.join(ARTIFACT_ROOT, viewportName);
	if (CAPTURE_AUDIT_SCREENSHOTS) {
		fs.mkdirSync(viewportDir, { recursive: true });
	}

	await page.goto('/xv/demo-xv', { waitUntil: 'domcontentloaded' });

	await expect(page.locator('.envelope-wrapper')).toBeVisible();
	if (CAPTURE_AUDIT_SCREENSHOTS) {
		await page.screenshot({
			path: path.join(viewportDir, '00-envelope-closed.png'),
			fullPage: true,
		});
	}

	await page.getByRole('button', { name: 'Abrir sobre de la invitación' }).click();
	await waitForRevealCardInsideViewport(page);

	await expect(page.locator('.event-theme-wrapper')).toHaveAttribute(
		'data-reveal-state',
		'revealed',
	);

	await expect(page.locator('#inicio')).toBeVisible();
	if (CAPTURE_AUDIT_SCREENSHOTS) {
		await waitForStableElementBox(page, '#inicio');
		await page.screenshot({
			path: path.join(viewportDir, '01-full-page-revealed.png'),
			fullPage: true,
		});
	}

	for (const selector of SECTION_SELECTORS) {
		const safeName = selector.replaceAll('#', '');
		const section = page.locator(selector);
		await expect(section).toBeVisible();
		await section.scrollIntoViewIfNeeded();
		if (selector === '#family-section') {
			await page.waitForFunction(() => {
				const family = document.querySelector('#family-section');
				return family?.classList.contains('is-visible');
			});
		}
		await waitForStableElementBox(page, selector);
		if (CAPTURE_AUDIT_SCREENSHOTS) {
			await section.screenshot({
				path: path.join(viewportDir, `section-${safeName}.png`),
			});
		}
	}
}

async function waitForRevealCardInsideViewport(page: Page) {
	await page.waitForFunction(() => {
		const card = document.querySelector('.invitation-reveal-card');
		if (!card) return false;

		const box = card.getBoundingClientRect();
		return (
			box.width > 0 &&
			box.height > 0 &&
			box.top >= 0 &&
			box.left >= 0 &&
			box.bottom <= window.innerHeight &&
			box.right <= window.innerWidth
		);
	});
}

async function waitForStableElementBox(page: Page, selector: string) {
	await page.waitForFunction(async (targetSelector) => {
		const element = document.querySelector(targetSelector);
		if (!element) return false;

		const first = element.getBoundingClientRect();
		await new Promise((resolve) => requestAnimationFrame(resolve));
		const second = element.getBoundingClientRect();

		return (
			first.width > 0 &&
			first.height > 0 &&
			Math.abs(first.top - second.top) < 1 &&
			Math.abs(first.left - second.left) < 1 &&
			Math.abs(first.width - second.width) < 1 &&
			Math.abs(first.height - second.height) < 1
		);
	}, selector);
}
