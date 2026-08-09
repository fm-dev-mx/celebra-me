import { expect, test, type Page } from '@playwright/test';

const representativeRoutes = [
	'/cumple/demo-cumple-luxury-hacienda',
	'/boda/demo-boda-jewelry-box-wedding',
	'/xv/demo-xv-xareni-profile',
	'/bautizo/demo-bautismo-angelic-presence',
	'/baby-shower/demo-baby-shower-celestial',
] as const;

const sealSizingRoutes = [
	'/boda/victoria-y-roberto',
	'/boda/demo-boda-jewelry-box-wedding',
	'/boda/daniela-y-martin',
	'/cumple/alba-rosa-quinonez',
	'/baby-shower/demo-baby-shower-celestial',
] as const;

async function expectRevealed(page: Page) {
	await expect(page.locator('.event-theme-wrapper')).toHaveAttribute(
		'data-reveal-state',
		'revealed',
	);
	await expect(page.locator('.envelope-wrapper')).toBeHidden();
	await expect(page.locator('#inicio')).toBeVisible();
}

test.describe('shared envelope reveal interaction', () => {
	test('uses the same closed-state transition from the seal and CTA', async ({ page }) => {
		await page.goto('/cumple/demo-cumple-luxury-hacienda', { waitUntil: 'domcontentloaded' });

		const seal = page.getByRole('button', { name: 'Abrir sobre de la invitación' });
		const cta = page.getByRole('button', { name: 'Abrir la invitación' });
		await expect(seal).toBeVisible();
		await expect(cta).toBeVisible();
		await expect(page.locator('[data-envelope-card]')).toHaveAttribute('aria-hidden', 'true');
		await expect(page.locator('[data-envelope-card]')).toHaveCSS('opacity', '0');
		await expect(page.locator('[data-envelope-card] [data-envelope-open]')).toHaveCount(0);

		await cta.click();
		await expectRevealed(page);

		await page.goto('/cumple/demo-cumple-luxury-hacienda?forceEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		await page.getByRole('button', { name: 'Abrir sobre de la invitación' }).click();
		await expectRevealed(page);
	});

	test('supports Enter and Space and never finalizes twice', async ({ page }) => {
		await page.goto('/boda/demo-boda-jewelry-box-wedding', { waitUntil: 'domcontentloaded' });
		await page.evaluate(() => {
			(window as Window & { envelopeOpenedCount?: number }).envelopeOpenedCount = 0;
			window.addEventListener('envelope:opened', () => {
				const current =
					(window as Window & { envelopeOpenedCount?: number }).envelopeOpenedCount ?? 0;
				(window as Window & { envelopeOpenedCount?: number }).envelopeOpenedCount =
					current + 1;
			});
		});

		const cta = page.getByRole('button', { name: 'Abrir la invitación' });
		await cta.focus();
		await page.keyboard.press('Space');
		await expectRevealed(page);
		await expect(page.locator('.envelope-wrapper')).toHaveCount(1);
		await expect
			.poll(() =>
				page.evaluate(
					() => (window as Window & { envelopeOpenedCount?: number }).envelopeOpenedCount,
				),
			)
			.toBe(1);

		await page.goto('/boda/demo-boda-jewelry-box-wedding?forceEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		await page.evaluate(() => {
			(window as Window & { envelopeOpenedCount?: number }).envelopeOpenedCount = 0;
			window.addEventListener('envelope:opened', () => {
				const current =
					(window as Window & { envelopeOpenedCount?: number }).envelopeOpenedCount ?? 0;
				(window as Window & { envelopeOpenedCount?: number }).envelopeOpenedCount =
					current + 1;
			});
			const button = document.querySelector<HTMLButtonElement>(
				'.envelope-external-instruction__button',
			);
			button?.click();
			button?.click();
		});
		await expectRevealed(page);
		await expect
			.poll(() =>
				page.evaluate(
					() => (window as Window & { envelopeOpenedCount?: number }).envelopeOpenedCount,
				),
			)
			.toBe(1);

		await page.goto('/boda/demo-boda-jewelry-box-wedding?forceEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		const seal = page.getByRole('button', { name: 'Abrir sobre de la invitación' });
		await seal.focus();
		await page.keyboard.press('Enter');
		await expectRevealed(page);
	});

	test('@extended keeps presentation-only letter card in preview and uses an accessible focus ring', async ({
		page,
	}) => {
		await page.goto('/cumple/demo-cumple-luxury-hacienda?screenshot=1&reveal=letter', {
			waitUntil: 'domcontentloaded',
		});

		await expect(page.locator('.envelope-external-instruction__button')).toBeHidden();
		await expect(
			page.locator('[data-screenshot="reveal-letter"] [data-envelope-open]'),
		).toHaveCount(0);

		await page.goto('/cumple/demo-cumple-luxury-hacienda?forceEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		const seal = page.getByRole('button', { name: 'Abrir sobre de la invitación' });
		await seal.focus();
		const focusRing = seal.locator('.envelope-seal-button__visual');
		await expect(focusRing).toHaveCSS('outline-style', 'solid');
		await expect(focusRing).toHaveCSS('outline-width', '3px');
	});

	test('transfers focus and preserves reduced-motion behavior', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/xv/demo-xv-xareni-profile', { waitUntil: 'domcontentloaded' });
		const seal = page.getByRole('button', { name: 'Abrir sobre de la invitación' });
		await seal.focus();
		await seal.click();
		await expectRevealed(page);
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						!document
							.querySelector('ds-envelope-reveal')
							?.contains(document.activeElement),
				),
			)
			.toBe(true);
	});

	test('@extended keeps the seal proportionate across profiles and viewports', async ({
		page,
	}) => {
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 1440, height: 1200 },
		]) {
			await page.setViewportSize(viewport);

			for (const route of sealSizingRoutes) {
				await page.goto(`${route}?forceEnvelope=true`, { waitUntil: 'domcontentloaded' });

				const metrics = await page.evaluate(() => {
					const container = document.querySelector<HTMLElement>('.envelope-container');
					const visual = document.querySelector<HTMLElement>(
						'.envelope-seal-button__visual',
					);
					const button =
						document.querySelector<HTMLButtonElement>('.envelope-seal-button');

					if (!container || !visual || !button) {
						throw new Error('Envelope seal sizing surface is missing');
					}

					const containerWidth = container.getBoundingClientRect().width;
					const visualWidth = visual.getBoundingClientRect().width;
					const buttonRect = button.getBoundingClientRect();

					return {
						containerWidth,
						visualWidth,
						buttonWidth: buttonRect.width,
						buttonHeight: buttonRect.height,
					};
				});

				const expectedVisualSize = Math.min(60, Math.max(40, metrics.containerWidth * 0.1));

				expect(Math.abs(metrics.visualWidth - expectedVisualSize)).toBeLessThanOrEqual(1);
				expect(metrics.buttonWidth).toBeGreaterThanOrEqual(48);
				expect(metrics.buttonHeight).toBeGreaterThanOrEqual(48);
			}
		}
	});

	test('@extended keeps Alba Rosa’s reveal, countdown, and map hierarchy senior-friendly', async ({
		page,
	}) => {
		await page.goto('/cumple/alba-rosa-quinonez?skipEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});

		await expect(page.getByRole('heading', { name: 'FALTAN' })).toBeVisible();
		await expect(page.locator('.countdown__segment[data-unit="days"]')).toContainText('Días');
		await expect(page.getByRole('heading', { name: 'Los esperamos' })).toHaveCount(0);
		await expect(page.getByText('Canta Luna Campestre', { exact: true }).first()).toBeVisible();
		await expect(page.locator('.google-map-container')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Google Maps ↗' })).toBeVisible();
		await expect(page.getByText('Vestimenta — Formal')).toBeVisible();

		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 768, height: 1024 },
			{ width: 906, height: 870 },
			{ width: 1024, height: 768 },
			{ width: 1440, height: 900 },
		]) {
			await page.setViewportSize(viewport);
			await expect
				.poll(() =>
					page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth),
				)
				.toBe(true);
		}

		await page.goto('/cumple/alba-rosa-quinonez?screenshot=1&reveal=letter', {
			waitUntil: 'domcontentloaded',
		});
		await expect(page.locator('[data-screenshot="reveal-letter"]')).toContainText('70 AÑOS');
		await expect(page.locator('[data-screenshot="reveal-letter"]')).not.toContainText(
			'ABRIR LA INVITACIÓN',
		);
	});

	for (const route of representativeRoutes) {
		test(`@extended reveals representative shared invitation ${route}`, async ({ page }) => {
			await page.goto(route, { waitUntil: 'domcontentloaded' });
			await page.getByRole('button', { name: 'Abrir la invitación' }).click();
			await expectRevealed(page);
		});
	}
});
