import { expect, test } from '@playwright/test';
import path from 'node:path';
import { prepareCompletePage } from './harness/complete-page-capture';

const invitationUrl =
	'/test/variant?full=1&presentation=1&eventType=boda&slug=melissa-y-luis-osmar&screenshot=true&animations=off';

const viewports = [
	{ name: '320x800', width: 320, height: 800 },
	{ name: '360x800', width: 360, height: 800 },
	{ name: '390x844', width: 390, height: 844 },
	{ name: '430x932', width: 430, height: 932 },
	{ name: '768x1024', width: 768, height: 1024 },
	{ name: '1440x900', width: 1440, height: 900 },
	{ name: '1440x600', width: 1440, height: 600 },
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
	const opening = await page.locator('.ceremonial-portrait-hero').evaluate((hero) => {
		const landscape = getComputedStyle(hero, '::after');
		const bounds = hero.getBoundingClientRect();
		const date = hero.querySelector('.ceremonial-portrait-hero__date')!;
		return {
			dateBottom: date.getBoundingClientRect().bottom,
			landscapeTop:
				bounds.bottom - parseFloat(landscape.bottom) - parseFloat(landscape.height),
		};
	});
	expect(opening.dateBottom).toBeLessThanOrEqual(opening.landscapeTop);
}

async function expectContentContainersToReflow(page: import('@playwright/test').Page) {
	const overflow = await page.evaluate(() => {
		const selectors = [
			'.ceremonial-portrait-hero__paper',
			'.ceremonial-portrait-hero__name',
			'.countdown__timer',
			'.family__header',
			'.family__content',
			'.event-location__intro',
			'.event-location__card-wrapper',
			'.event-location__indications-container',
			'.itinerary__header',
			'.itinerary__items',
			'.gifts-section__header',
			'.gifts-grid',
			'.gift-card',
			'.personalized-access__container',
			'.access-card',
			'.rsvp',
		];

		return selectors.flatMap((selector) =>
			Array.from(document.querySelectorAll<HTMLElement>(selector))
				.filter((element) => element.getClientRects().length > 0)
				.filter((element) => element.scrollWidth > element.clientWidth + 1)
				.map((element) => ({
					selector,
					className: element.className,
					clientWidth: element.clientWidth,
					scrollWidth: element.scrollWidth,
					descendants: Array.from(element.querySelectorAll<HTMLElement>('*'))
						.filter((child) => child.scrollWidth > child.clientWidth + 1)
						.slice(0, 5)
						.map((child) => ({
							className: child.className,
							clientWidth: child.clientWidth,
							scrollWidth: child.scrollWidth,
						})),
				})),
		);
	});

	expect(overflow).toEqual([]);
}

test.describe('Melissa y Luis Osmar local visual contract', () => {
	for (const viewport of viewports) {
		test(`renders the complete invitation at ${viewport.name}`, async ({ page }) => {
			await page.setViewportSize(viewport);
			const response = await page.goto(invitationUrl, { waitUntil: 'load' });
			expect(response?.status()).toBe(200);
			await expectStableInvitation(page);
			const crest = page.locator('.ceremonial-portrait-hero__crest');
			await expect(crest).toHaveAttribute('aria-hidden', 'true');
			await expect(crest).toBeHidden();
			await expect(page.locator('.ceremonial-portrait-hero__date')).toHaveCSS('opacity', '1');
			const timerColumns = await page
				.locator('.countdown__timer')
				.evaluate(
					(element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
				);
			expect(timerColumns).toBe(viewport.width <= 384 ? 2 : 4);
			for (const label of await page.locator('.countdown__label').all()) {
				const lines = await label.evaluate((element) => {
					const range = document.createRange();
					range.selectNodeContents(element);
					return range.getClientRects().length;
				});
				expect(lines).toBe(1);
			}
			const hero = page.locator('.ceremonial-portrait-hero');
			const landscape = await hero.evaluate(
				(element) => getComputedStyle(element, '::after').backgroundImage,
			);
			expect(landscape).toContain('hero-landscape');
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

	for (const viewport of [
		{ name: '320x800', width: 320, height: 800 },
		{ name: '360x800', width: 360, height: 800 },
	] as const) {
		test(`keeps long content contained at 200% text size at ${viewport.name}`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			await page.goto(invitationUrl, { waitUntil: 'load' });
			await page.locator('html').evaluate((root) => {
				root.style.fontSize = '200%';
			});
			await expectStableInvitation(page);
			await expectContentContainersToReflow(page);
		});
	}

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

	test('keeps copy controls touch-sized and keyboard focus visible', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(invitationUrl, { waitUntil: 'load' });
		await expectStableInvitation(page);
		const controls = page.locator(
			'.event-location__card-content-copy-button, .gift-card .copy-icon-button',
		);
		await expect(controls).toHaveCount(3);
		for (const control of await controls.all()) {
			const bounds = await control.boundingBox();
			expect(bounds?.width).toBeGreaterThanOrEqual(44);
			expect(bounds?.height).toBeGreaterThanOrEqual(44);
		}
		await page.keyboard.press('Tab');
		await controls.first().focus();
		await expect(controls.first()).toHaveCSS('outline-style', 'solid');
	});

	test('keeps informational cards still on hover', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(invitationUrl, { waitUntil: 'load' });
		await expectStableInvitation(page);
		for (const card of await page.locator('.event-location__card-wrapper, .gift-card').all()) {
			await card.hover();
			await expect(card).toHaveCSS('transform', 'none');
			await expect(card).toHaveCSS('box-shadow', 'none');
			await expect(card).toHaveCSS('backdrop-filter', 'none');
		}
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
			await expectContentContainersToReflow(page);
			const pass = page.locator('.personalized-access');
			// The variant alone cannot render the card without the canonical base stylesheet.
			await expect(pass.locator('.access-card')).not.toHaveCSS('background-image', 'none');
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

	test('uses one media arrival instead of the shared ambient loop', async ({ page }) => {
		await page.goto(invitationUrl, { waitUntil: 'load' });
		await expectStableInvitation(page);
		const image = page.locator('.invitation-interlude__image').first();
		await expect(image).toHaveCSS('animation-name', 'melissa-media-arrival');
		await expect(image).toHaveCSS('animation-iteration-count', '1');
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
