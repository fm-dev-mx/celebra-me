import { expect, test, type Page } from '@playwright/test';

const representativeRoutes = [
	'/cumple/demo-cumple-luxury-hacienda',
	'/boda/demo-brisa',
	'/xv/demo-xv-celestial-blue',
	'/bautizo/demo-bautizo-angelic-presence',
	'/xv/allison-scarlett',
] as const;

// Classic envelopes only: the night envelope (demo-brisa) draws its own larger wax seal.
const sealSizingRoutes = [
	'/boda/victoria-y-roberto',
	'/boda/daniela-y-martin',
	'/cumple/alba-rosa-quinonez',
] as const;

// The night envelope's arch hand-over (card rise, hold, photo flight) takes about 5.4s.
const REVEAL_TIMEOUT_MS = 10_000;

async function expectRevealed(page: Page) {
	await expect(page.locator('.event-theme-wrapper')).toHaveAttribute(
		'data-reveal-state',
		'revealed',
		{ timeout: REVEAL_TIMEOUT_MS },
	);
	await expect(page.locator('.envelope-wrapper')).toBeHidden();
	await expect(page.locator('#inicio')).toBeVisible();
}

test.describe('shared envelope reveal interaction', () => {
	test('keeps XV controls inactive until the reveal script is ready', async ({ page }) => {
		let releaseScripts!: () => void;
		const scriptsReady = new Promise<void>((resolve) => {
			releaseScripts = resolve;
		});
		await page.route('**/*', async (route) => {
			if (route.request().resourceType() === 'script') await scriptsReady;
			await route.continue();
		});
		try {
			await page.goto('/xv/demo-xv-enchanted-rose?forceEnvelope=true', {
				waitUntil: 'commit',
			});
			const seal = page.getByRole('button', { name: 'Abrir sobre de la invitación' });
			await expect(seal).toBeVisible();
			await expect(seal).toBeDisabled();
			releaseScripts();
			await expect(seal).toBeEnabled();
			await seal.click();
			await expectRevealed(page);
		} finally {
			releaseScripts();
		}
	});
	for (const trigger of ['CTA', 'seal'] as const) {
		test(`uses the same closed-state transition from the ${trigger}`, async ({ page }) => {
			const route = '/cumple/demo-cumple-luxury-hacienda';
			await page.goto(trigger === 'seal' ? `${route}?forceEnvelope=true` : route, {
				waitUntil: 'domcontentloaded',
			});
			const seal = page.getByRole('button', { name: 'Abrir sobre de la invitación' });
			const cta = page.getByRole('button', { name: 'Abrir la invitación' });
			await expect(seal).toBeVisible();
			await expect(cta).toBeVisible();
			await expect(page.locator('[data-envelope-card]')).toHaveAttribute(
				'aria-hidden',
				'true',
			);
			await expect(page.locator('[data-envelope-card]')).toHaveCSS('opacity', '0');
			await expect(page.locator('[data-envelope-card] [data-envelope-open]')).toHaveCount(0);
			await (trigger === 'seal' ? seal : cta).click();
			await expectRevealed(page);
		});
	}

	// Each night-envelope reveal takes about 7.6s (arch hand-over plus host exit), so every
	// scenario gets its own test budget instead of chaining three reveals in one.
	async function trackEnvelopeOpened(page: Page) {
		await page.evaluate(() => {
			(window as Window & { envelopeOpenedCount?: number }).envelopeOpenedCount = 0;
			window.addEventListener('envelope:opened', () => {
				const current =
					(window as Window & { envelopeOpenedCount?: number }).envelopeOpenedCount ?? 0;
				(window as Window & { envelopeOpenedCount?: number }).envelopeOpenedCount =
					current + 1;
			});
		});
	}

	async function expectOpenedOnce(page: Page) {
		await expect
			.poll(() =>
				page.evaluate(
					() => (window as Window & { envelopeOpenedCount?: number }).envelopeOpenedCount,
				),
			)
			.toBe(1);
	}

	test('opens from Space on the external call to action', async ({ page }) => {
		await page.goto('/boda/demo-brisa', { waitUntil: 'domcontentloaded' });
		await trackEnvelopeOpened(page);

		const cta = page.getByRole('button', { name: 'Abrir la invitación' });
		await expect(cta).toBeEnabled();
		await cta.focus();
		await page.keyboard.press('Space');
		await expectRevealed(page);
		await expect(page.locator('.envelope-wrapper')).toHaveCount(1);
		await expectOpenedOnce(page);
	});

	test('never finalizes twice on a double activation', async ({ page }) => {
		await page.goto('/boda/demo-brisa?forceEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		await trackEnvelopeOpened(page);
		await page.evaluate(() => {
			const button = document.querySelector<HTMLButtonElement>(
				'.envelope-external-instruction__button',
			);
			button?.click();
			button?.click();
		});
		await expectRevealed(page);
		await expectOpenedOnce(page);
	});

	test('opens from Enter on the seal', async ({ page }) => {
		await page.goto('/boda/demo-brisa?forceEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		const seal = page.getByRole('button', { name: 'Abrir sobre de la invitación' });
		await expect(seal).toBeEnabled();
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
		await page.goto('/xv/demo-xv-celestial-blue', { waitUntil: 'domcontentloaded' });
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
				await page.goto(`${route}?forceEnvelope=true`, { waitUntil: 'load' });

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

				const expectedVisualSize = Math.min(60, Math.max(34, metrics.containerWidth * 0.1));

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

	test('plays music only on a tap and pauses it from the same control', async ({ page }) => {
		// The demo's track has autoPlay false. Headless Chromium may lack the codec, so the media
		// element reports its calls and fires the events a real playback would.
		await page.route('**/*.mp3', (route) => route.fulfill({ status: 204, body: '' }));
		await page.addInitScript(() => {
			// Keep the cookie banner from covering the player.
			window.localStorage.setItem(
				'cm_consent',
				JSON.stringify({
					necessary: true,
					analytics: false,
					marketing: false,
					updatedAt: new Date().toISOString(),
				}),
			);
			const calls = { play: 0, pause: 0 };
			(window as Window & { musicCalls?: typeof calls }).musicCalls = calls;
			HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
				calls.play += 1;
				this.dispatchEvent(new Event('playing'));
				return Promise.resolve();
			};
			HTMLMediaElement.prototype.pause = function pause(this: HTMLMediaElement) {
				calls.pause += 1;
				this.dispatchEvent(new Event('pause'));
			};
		});
		const musicCalls = () =>
			page.evaluate(
				() =>
					(window as Window & { musicCalls?: { play: number; pause: number } })
						.musicCalls,
			);

		await page.goto('/xv/demo-xv-enchanted-rose?forceEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		await page.getByRole('button', { name: 'Abrir sobre de la invitación' }).click();
		await expectRevealed(page);
		const toggle = page.locator('[data-music-toggle]');
		await expect(toggle).toHaveAttribute('aria-label', 'Música de fondo');
		expect(await musicCalls()).toEqual({ play: 0, pause: 0 });

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-label', 'Pausar música');
		await expect(toggle.locator('[data-icon-pause]')).toBeVisible();
		expect(await musicCalls()).toEqual({ play: 1, pause: 0 });

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-label', 'Música de fondo');
		await expect(toggle.locator('[data-icon-play]')).toBeVisible();
		expect(await musicCalls()).toEqual({ play: 1, pause: 1 });
	});

	for (const route of representativeRoutes) {
		test(`@extended reveals representative shared invitation ${route}`, async ({ page }) => {
			await page.goto(route, { waitUntil: 'domcontentloaded' });
			await page.getByRole('button', { name: 'Abrir la invitación' }).click();
			await expectRevealed(page);
		});
	}
});
