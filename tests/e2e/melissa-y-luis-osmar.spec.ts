import { expect, test } from '@playwright/test';
import path from 'node:path';
import { prepareCompletePage } from './harness/complete-page-capture';

const invitationUrl =
	'/test/variant?full=1&eventType=boda&slug=melissa-y-luis-osmar&screenshot=true&animations=off';

const viewports = [
	{ name: '320x800', width: 320, height: 800 },
	{ name: '360x800', width: 360, height: 800 },
	{ name: '390x844', width: 390, height: 844 },
	{ name: '430x932', width: 430, height: 932 },
	{ name: '1440x900', width: 1440, height: 900 },
] as const;

async function expectStableInvitation(
	page: import('@playwright/test').Page,
	expectedSectionCount = 10,
) {
	await page.evaluate(() => document.fonts.ready);
	await prepareCompletePage(page);
	await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
	await expect(page.locator('#test-invitation-root.event--melissa-y-luis-osmar')).toBeVisible();
	// Personalized access is rendered inside the RSVP chapter, so the DOM has
	// nine section wrappers plus the two interludes minus that nested plan item.
	await expect(page.locator('.invitation-section-wrapper[data-section-kind]')).toHaveCount(
		expectedSectionCount,
	);

	const layout = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		viewportWidth: window.innerWidth,
		brokenImages: Array.from(document.images)
			.filter((image) => image.currentSrc && image.naturalWidth === 0)
			.map((image) => image.currentSrc),
	}));
	expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
	expect(layout.brokenImages).toEqual([]);
}

test.describe('Melissa y Luis Osmar local visual contract', () => {
	for (const viewport of viewports) {
		test(`renders the complete invitation at ${viewport.name}`, async ({ page }) => {
			await page.setViewportSize(viewport);
			const response = await page.goto(invitationUrl, { waitUntil: 'load' });
			expect(response?.status()).toBe(200);
			await expectStableInvitation(page);
			await page.screenshot({
				path: path.join(
					process.cwd(),
					'.tmp',
					'visual-review',
					'melissa-y-luis-osmar',
					`${viewport.name}.png`,
				),
				fullPage: true,
				animations: 'disabled',
			});
		});
	}

	test('keeps long content contained at 200% text size', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 800 });
		await page.goto(invitationUrl, { waitUntil: 'load' });
		await page.locator('html').evaluate((root) => {
			root.style.fontSize = '200%';
		});
		await expectStableInvitation(page);
	});

	test('keeps the sealed envelope and raised letter operable at 320px', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		const envelopeUrl = invitationUrl.replace('screenshot=true', 'screenshot=1');
		await page.goto(`${envelopeUrl}&envelope=1&presentation=1`, { waitUntil: 'load' });
		const envelope = page.locator('[data-screenshot="reveal-section"]');
		await expect(envelope).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Abrir sobre de la invitación' }),
		).toBeVisible();
		await page.getByRole('button', { name: 'Abrir sobre de la invitación' }).click();
		await expect(envelope).toHaveClass(/is-letter-held/);
		await expect(page.locator('[data-screenshot="reveal-letter"]')).toBeVisible();
	});

	for (const seats of [1, 2, 6]) {
		test(`renders a synthetic personalized pass for ${seats} seat${seats === 1 ? '' : 's'}`, async ({
			page,
		}) => {
			await page.setViewportSize({ width: 320, height: 800 });
			const guestName = 'María Fernanda Alejandra de la Luz Solís Mendoza';
			await page.goto(
				`${invitationUrl}&guestSeats=${seats}&guestName=${encodeURIComponent(guestName)}`,
				{ waitUntil: 'load' },
			);
			await page.locator('html').evaluate((root) => {
				root.style.fontSize = '200%';
			});
			await expectStableInvitation(page, 11);
			const pass = page.locator('.personalized-access');
			await expect(pass).toContainText(guestName);
			await expect(pass).toContainText(
				seats === 1 ? 'Lugar reservado' : 'Lugares reservados',
			);
			const bounds = await pass.evaluate((element) => ({
				left: element.getBoundingClientRect().left,
				right: element.getBoundingClientRect().right,
				viewport: window.innerWidth,
			}));
			expect(bounds.left).toBeGreaterThanOrEqual(0);
			expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
		});
	}

	test('covers blocked, validation-error, form, and confirmed RSVP states without persistence', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(invitationUrl, { waitUntil: 'load' });
		await expect(page.getByText('Confirme su asistencia')).toBeVisible();
		await expect(page.locator('#rsvp-form')).toHaveCount(0);

		// Demo-preview mode suppresses persistence and uses DEMO_GUEST_NAME on confirmation
		await page.goto(
			`${invitationUrl}&guestSeats=2&guestName=${encodeURIComponent('María Fernanda Solís')}`,
			{ waitUntil: 'load' },
		);
		const rsvpWrapper = page.locator('.invitation-section-wrapper[data-section-kind="rsvp"]');
		await rsvpWrapper.scrollIntoViewIfNeeded();
		await expect(rsvpWrapper.locator('astro-island')).not.toHaveAttribute('ssr');
		await expect(page.locator('#rsvp-form')).toBeVisible();
		await page.locator('#attendance-yes').evaluate((input) => {
			(input as HTMLInputElement).click();
		});
		await expect(page.getByText('Sí, asistiré', { exact: true })).toBeVisible();
		const guestCount = page.locator('#guestCount');
		await expect(guestCount).toBeVisible();
		await guestCount.fill('9');
		await page
			.locator('#rsvp-form')
			.getByRole('button', { name: /confirmar/i })
			.click();
		await expect(page.getByRole('alert')).toBeVisible();

		await guestCount.fill('2');
		await page
			.locator('#rsvp-form')
			.getByRole('button', { name: /confirmar/i })
			.click();
		await expect(page.getByText('Confirmación recibida, María Fernanda Solís.')).toBeVisible({
			timeout: 3_000,
		});
	});

	test('resolves reduced motion without a persistent media animation', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(invitationUrl, { waitUntil: 'load' });
		await expectStableInvitation(page);
		await expect(page.locator('.invitation-interlude__image').first()).toHaveCSS(
			'animation-name',
			'none',
		);
	});

	test('delivers the complete editorial content without JavaScript', async ({ browser }) => {
		const context = await browser.newContext({
			javaScriptEnabled: false,
			viewport: { width: 390, height: 844 },
		});
		const page = await context.newPage();
		try {
			const response = await page.goto(invitationUrl, { waitUntil: 'load' });
			expect(response?.status()).toBe(200);
			await expect(
				page.locator('#test-invitation-root.event--melissa-y-luis-osmar'),
			).toBeVisible();
			await expect(page.getByText('Melissa', { exact: true }).first()).toBeVisible();
			await expect(page.getByText('Confirme su asistencia')).toBeVisible();
			await expect(page.getByText('60019030')).toBeVisible();
			await expect(
				page.getByText('16 de diciembre de 2026', { exact: true }).last(),
			).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
