import { expect, test, type Page } from '@playwright/test';

test.describe('Landing page regressions', () => {
	const expectedNavLabels = ['Demos', 'Planes', 'Nosotros'];
	const expectedMobileNavLabels = ['DEMOS', 'PLANES', 'NOSOTROS'];
	const loginHref = '/login?next=%2Fdashboard%2Finvitados';
	const loginLabel = 'Iniciar sesión';
	const ctaHref = '#contacto';
	const sectionHeaderIsBelowStickyHeader = async (page: Page, headingSelector: string) => {
		const geometry = await page.locator(headingSelector).evaluate((heading) => {
			const header = document.querySelector('#home-header');
			const headingBox = heading.getBoundingClientRect();
			const headerBox = header?.getBoundingClientRect();

			return {
				headingTop: headingBox.top,
				headerBottom: headerBox?.bottom ?? 0,
			};
		});

		expect(geometry.headingTop).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
	};

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

	test.beforeEach(async ({ page }) => {
		page.on('pageerror', (error) => {
			throw new Error('Page JS error: ' + error.message);
		});
		page.on('requestfailed', (req) => {
			if (req.resourceType() === 'document') return;
			console.warn(
				'Request failed: ' + req.url() + ' (' + (req.failure()?.errorText ?? '') + ')',
			);
		});
	});

	test('keeps the correct navigation at mobile and tablet breakpoints', async ({ page }) => {
		for (const viewport of [
			{ width: 390, height: 844 },
			{ width: 768, height: 1024 },
		]) {
			await page.setViewportSize(viewport);
			await page.goto('/', { waitUntil: 'load' });

			await expect(page.locator('[data-nav-mobile-toggle]')).toBeVisible();
			await expect(page.locator('.header-base__desktop-nav')).toBeHidden();
			await expect(page.locator('.services__spec-row').first()).toBeVisible();
			await expect(page.locator('#experiencia-invitados')).toBeVisible();

			await page.locator('[data-nav-mobile-toggle]').click();
			await expect(page.locator('[data-nav-mobile-menu]')).toBeVisible();
			await expect(page.locator('.mobile-nav-links__link')).toHaveText(
				expectedMobileNavLabels,
				{
					useInnerText: true,
				},
			);
			await expect(page.locator('.mobile-nav-actions__login')).toHaveText(loginLabel);
			await expect(page.locator('.mobile-nav-actions__login')).toHaveAttribute(
				'href',
				loginHref,
			);
			await expect(page.locator('.mobile-nav-actions__cta')).toHaveAttribute('href', ctaHref);
			await expect(page.locator('#home-header')).toHaveClass(/header-base--menu-open/);
		}
	});

	test('keeps the desktop navigation visible and readable on desktop', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/', { waitUntil: 'load' });
		await scrollLandingHeader(page);

		await expect(page.locator('.header-base__desktop-nav')).toBeVisible();
		await expect(page.locator('[data-nav-mobile-toggle]')).toBeHidden();
		await expect(page.locator('.home-nav__link')).toHaveText(expectedNavLabels);
		await expect(page.locator('.home-nav-actions__login')).toHaveText(loginLabel);
		await expect(page.locator('.home-nav-actions__login')).toHaveAttribute('href', loginHref);
		await expect(page.locator('.home-nav-actions__cta')).toHaveAttribute('href', ctaHref);

		const navLinkStyles = await page
			.locator('.home-nav__link')
			.first()
			.evaluate((element) => {
				const styles = window.getComputedStyle(element);
				return {
					color: styles.color,
					opacity: styles.opacity,
					borderBottomColor: styles.borderBottomColor,
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
		expect(navLinkStyles.borderBottomColor).not.toBe('rgba(0, 0, 0, 0)');
		expect(ctaStyles.opacity).toBe('1');
		expect(ctaStyles.color).not.toBe(ctaStyles.backgroundColor);
	});

	test('keeps the FAQ accordion stable while toggling', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/', { waitUntil: 'load' });

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
		await page.goto('/', { waitUntil: 'load' });

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

	test('states the operational product promise above the fold', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/', { waitUntil: 'load' });

		await expect(page.locator('#hero-title')).toContainText(
			'Invitaciones digitales elegantes para confirmar y guiar a tus invitados',
		);
		await expect(page.locator('.hero-prime__eyebrow')).toContainText(
			'Invitaciones digitales premium',
		);
		await expect(page.locator('.hero-prime__subtitle')).toContainText('RSVP');
		await expect(page.locator('.hero-prime__subtitle')).toContainText('pases digitales');
		await expect(page.locator('.hero-prime__subtitle')).toContainText('WhatsApp');
		const heroCta = page.locator('[data-track-cta="whatsapp-hero"]');
		await expect(heroCta).toBeVisible();
		await expect(page.locator('.hero-prime__selector')).toHaveCount(0);
		await expect(page.locator('.hero-prime .phone-mockup')).toHaveCount(0);
		await expect(page.locator('.hero-prime__proof')).toHaveCount(0);
		await expect(page.locator('#tipo-evento .event-showroom__tabs')).toBeVisible();
		await expect(
			page.locator('#tipo-evento [data-panel-event="xv"] .event-showroom__phone-card'),
		).toContainText('Sofía Valentina');
		await expect(
			page.locator('#tipo-evento [data-panel-event="xv"] [data-showroom-feature]'),
		).toContainText(['RSVP', 'Pases', 'WhatsApp']);
	});

	test('keeps the hero CTA in reach on narrow mobile', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 740 });
		await page.goto('/', { waitUntil: 'load' });

		const heroCta = page.locator('[data-track-cta="whatsapp-hero"]');
		await expect(heroCta).toBeVisible();
		const ctaBox = await heroCta.boundingBox();

		expect(ctaBox).not.toBeNull();
		expect(ctaBox!.y).toBeLessThanOrEqual(740);
		expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(780);
	});

	test('uses the launch coupon and structured tracking on WhatsApp CTAs', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/', { waitUntil: 'load' });

		const heroCta = page.locator('[data-track-cta="whatsapp-hero"]');
		await expect(heroCta).toHaveAttribute('data-track-event', 'whatsapp_contact_clicked');
		await expect(heroCta).toHaveAttribute('data-promo-code', 'LANZAMIENTO-899');
		await expect(heroCta).toHaveAttribute('data-campaign-code', 'HERO-LANZAMIENTO-899');
		await expect(heroCta).toHaveAttribute('data-track-value', '899');

		const heroHref = await heroCta.getAttribute('href');
		expect(decodeURIComponent(heroHref ?? '')).toContain('Cupón: LANZAMIENTO-899');
		expect(decodeURIComponent(heroHref ?? '')).not.toContain('Folio: CM-899-');
		expect(decodeURIComponent(heroHref ?? '')).not.toContain('HERO-PROMO899');

		const clickedHref = await heroCta.evaluate((anchor) => {
			anchor.addEventListener('click', (event) => event.preventDefault(), { once: true });
			anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			return anchor.getAttribute('href') ?? '';
		});
		const clickedMessage = new URL(clickedHref).searchParams.get('text') ?? '';
		expect(clickedMessage).toContain('Cupón: LANZAMIENTO-899');
		expect(clickedMessage).toMatch(/Folio: CM-899-[A-Z0-9]{4}/);
	});

	test('keeps the event showroom personalization wired to WhatsApp context', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/', { waitUntil: 'load' });
		await page.locator('#tipo-evento').scrollIntoViewIfNeeded();

		await page.locator('[data-tab-event="boda"]').click();

		const eventCta = page.locator('[data-track-cta="showroom_quote_boda"]');
		await expect(page.locator('html')).toHaveAttribute('data-selected-event', 'boda');
		await expect(page.locator('.event-showroom__tab-btn[data-tab-event="boda"]')).toHaveClass(
			/active/,
		);
		await expect(page.locator('[data-panel-event="boda"]')).toHaveClass(/active/);
		await expect(
			page.locator('[data-panel-event="boda"] [data-showroom-kicker]'),
		).toContainText('Boda');
		await expect(page.locator('[data-panel-event="boda"] [data-showroom-title]')).toContainText(
			'Laura & Daniel',
		);
		await expect(eventCta).toContainText('Cotizar mi boda');
		await expect(eventCta).toHaveAttribute('data-event-type', 'boda');
		await expect(eventCta).toHaveAttribute('data-event-label', 'Boda');
		await expect(eventCta).toHaveAttribute('data-package-interest', 'premium');
		await expect(eventCta).toHaveAttribute('data-package-name', 'Premium');
		await expect(eventCta).toHaveAttribute('data-promo-code', 'LANZAMIENTO-1499');
		await expect(eventCta).toHaveAttribute('data-track-value', '1499');
		const eventHref = await eventCta.getAttribute('href');
		expect(decodeURIComponent(eventHref ?? '')).toContain('Evento: Boda');
		const clickedHref = await eventCta.evaluate((anchor) => {
			anchor.addEventListener('click', (event) => event.preventDefault(), { once: true });
			anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			return anchor.getAttribute('href') ?? '';
		});
		const clickedMessage = new URL(clickedHref).searchParams.get('text') ?? '';
		expect(clickedMessage).toContain('paquete Premium');
		expect(clickedMessage).toContain('Evento: Boda');
		expect(clickedMessage).toContain('Cupón: LANZAMIENTO-1499');
		expect(clickedMessage).toMatch(/Folio: CM-1499-[A-Z0-9]{4}/);
	});

	test('shows event categories before product proof', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/', { waitUntil: 'load' });

		// Single evaluate reads both positions atomically so a layout shift
		// between the two lookups can't make the comparison racy.
		const { proofTop, eventSelectorTop } = await page.evaluate(() => ({
			proofTop:
				document.getElementById('prueba-producto')!.getBoundingClientRect().top +
				window.scrollY,
			eventSelectorTop:
				document.getElementById('tipo-evento')!.getBoundingClientRect().top +
				window.scrollY,
		}));

		expect(eventSelectorTop).toBeLessThan(proofTop);
		await expect(page.locator('#product-proof-title')).toContainText(
			'Una invitación elegante con control de invitados',
		);
		await expect(page.locator('.proof-rail-flow__item')).toHaveCount(4);
		await expect(page.locator('.proof-rail-flow__item').first()).toContainText(
			'Quién recibió la invitación',
		);
		await expect(page.locator('#prueba-producto')).toHaveAttribute(
			'data-track-section',
			'product-proof',
		);
		await expect(page.locator('#tipo-evento')).toHaveAttribute(
			'data-track-section',
			'event-types',
		);
		await expect(page.locator('[data-track-cta="whatsapp-product-proof"]')).toBeVisible();
	});

	test('sends pricing CTAs directly to WhatsApp with package context', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/', { waitUntil: 'load' });
		await page.locator('#pricing').scrollIntoViewIfNeeded();

		await expect(page.locator('.pricing-title')).toContainText(
			'Elija el nivel de experiencia que quiere para su invitación',
		);
		await expect(page.locator('.pricing-note')).toContainText(
			'Promoción de lanzamiento desde $899 MXN. Pago único.',
		);

		const pricingCta = page
			.locator('.pricing-card')
			.first()
			.locator('[data-track-cta^="pricing_"]');
		await expect(pricingCta).toHaveAttribute('data-track-event', 'whatsapp_contact_clicked');
		await expect(pricingCta).toHaveAttribute('href', /wa\.me/);
		await expect(pricingCta).toHaveAttribute('data-campaign-code', 'PRICING-LANZAMIENTO-899');
		await expect(pricingCta).toHaveAttribute('data-package-name', 'Colección');
		await expect(pricingCta).toHaveAttribute('data-track-value', '899');

		const pricingHref = await pricingCta.getAttribute('href');
		expect(decodeURIComponent(pricingHref ?? '')).toContain('paquete Colección de $899 MXN');
	});

	test('keeps pricing visible without JavaScript', async ({ browser }) => {
		const context = await browser.newContext({
			javaScriptEnabled: false,
			viewport: { width: 390, height: 844 },
		});
		const page = await context.newPage();

		await page.goto('/', { waitUntil: 'domcontentloaded' });
		await page.locator('#pricing').scrollIntoViewIfNeeded();
		await expect(page.locator('.pricing-card').first()).toBeVisible({ timeout: 5000 });
		await expect(page.locator('.pricing-card')).toHaveCount(3);
		await expect(page.locator('.pricing-card').first()).toBeVisible();
		await expect(page.locator('.pricing-card').first()).toContainText('Colección');
		await expect(page.locator('.pricing-card').nth(1)).toContainText('Signature');
		await expect(page.locator('.pricing-card').nth(2)).toContainText('Atelier');
		await expect
			.poll(async () =>
				page
					.locator('.pricing-card')
					.first()
					.evaluate((element) => {
						return window.getComputedStyle(element).opacity;
					}),
			)
			.toBe('1');

		await context.close();
	});

	test('keeps pricing visible with reduced motion', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/', { waitUntil: 'load' });

		await page.locator('#pricing').scrollIntoViewIfNeeded();
		await expect(page.locator('.pricing-card').first()).toBeVisible({ timeout: 5000 });
		await expect(page.locator('.pricing-card')).toHaveCount(3);
		await expect(page.locator('.pricing-card').first()).toBeVisible();
		await expect
			.poll(async () =>
				page
					.locator('.pricing-card')
					.first()
					.evaluate((element) => {
						return window.getComputedStyle(element).opacity;
					}),
			)
			.toBe('1');
	});

	test('keeps hero content visible with reduced motion', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/', { waitUntil: 'load' });

		for (const selector of [
			'.hero-prime__eyebrow',
			'#hero-title',
			'.hero-prime__subtitle',
			'.hero-prime__actions',
		]) {
			await expect
				.poll(async () =>
					page
						.locator(selector)
						.evaluate((element) => window.getComputedStyle(element).opacity),
				)
				.toBe('1');
		}
		await expect(page.locator('.hero-prime__selector')).toHaveCount(0);
		await page.locator('#tipo-evento').scrollIntoViewIfNeeded();
		await page.locator('[data-tab-event="baby-shower"]').click();
		await expect(page.locator('[data-panel-event="baby-shower"]')).toHaveClass(/active/);
	});

	test('does not create horizontal overflow on narrow mobile', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 740 });
		await page.goto('/', { waitUntil: 'load' });

		const overflow = await page.evaluate(() => {
			return document.documentElement.scrollWidth - window.innerWidth;
		});

		expect(overflow).toBeLessThanOrEqual(1);
	});

	test('keeps section headings below the sticky header after anchor navigation', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/', { waitUntil: 'load' });

		await page.locator('[data-nav-mobile-toggle]').click();
		await page.locator('.mobile-nav-links__link', { hasText: 'PLANES' }).click();
		await sectionHeaderIsBelowStickyHeader(page, '.pricing-title');

		await page.goto('/#faq-section', { waitUntil: 'load' });
		await sectionHeaderIsBelowStickyHeader(page, '.faq-title');

		await page.goto('/#testimonios', { waitUntil: 'load' });
		await sectionHeaderIsBelowStickyHeader(page, '#testimonios h2');

		await page.goto('/#contacto', { waitUntil: 'load' });
		await sectionHeaderIsBelowStickyHeader(page, '.contact-title');
	});
});
