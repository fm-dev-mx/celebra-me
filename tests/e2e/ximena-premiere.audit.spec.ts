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

const TIMESTAMP = new Date().toISOString().replaceAll(':', '-');
const ARTIFACT_ROOT = path.resolve(
	process.cwd(),
	'temp',
	'ximena-premiere-audit',
	process.env.XIMENA_AUDIT_RUN_ID || TIMESTAMP,
);

test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

test.beforeAll(() => {
	fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
});

for (const viewport of VIEWPORTS) {
	test(`captures Ximena premiere baseline at ${viewport.name}`, async ({ page }) => {
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
				url.endsWith('.wav') ||
				url.endsWith('.m4a') ||
				url.endsWith('.M4A')
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

async function captureAuditFlow(page: Page, viewportName: string) {
	const viewportDir = path.join(ARTIFACT_ROOT, viewportName);
	fs.mkdirSync(viewportDir, { recursive: true });

	await page.goto('/xv/ximena-meza-trasvina', { waitUntil: 'domcontentloaded' });

	await expect(page.locator('.envelope-wrapper')).toBeVisible();
	await page.screenshot({
		path: path.join(viewportDir, '00-envelope-closed.png'),
		fullPage: true,
	});

	await page.getByRole('button', { name: 'Abrir sobre de la invitación' }).click();
	await expect(page.locator('.event-theme-wrapper')).toHaveAttribute(
		'data-reveal-state',
		'revealed',
	);
	await page.waitForTimeout(1200);

	await expect(page.locator('#inicio')).toBeVisible();
	await page.screenshot({
		path: path.join(viewportDir, '01-full-page-revealed.png'),
		fullPage: true,
	});

	for (const selector of SECTION_SELECTORS) {
		const safeName = selector.replaceAll('#', '');
		const section = page.locator(selector);
		await expect(section).toBeVisible();
		await section.scrollIntoViewIfNeeded();
		await page.waitForTimeout(350);
		await section.screenshot({
			path: path.join(viewportDir, `section-${safeName}.png`),
		});
	}

	const rsvpSection = page.locator('#rsvp');
	await rsvpSection.scrollIntoViewIfNeeded();
	// We use force: true because the input is sr-only and the dev-toolbar often intercepts pointer events
	await page.getByLabel('Sí, asistiré').click({ force: true });
	await page.waitForTimeout(200);
	await rsvpSection.screenshot({
		path: path.join(viewportDir, 'section-rsvp-confirmed-selected.png'),
	});

	await page.getByLabel('No podré asistir').click({ force: true });
	await page.waitForTimeout(200);
	await rsvpSection.screenshot({
		path: path.join(viewportDir, 'section-rsvp-declined-selected.png'),
	});
}
