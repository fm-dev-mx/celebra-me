import { expect, test, type Page } from '@playwright/test';
import {
	buildCampaignCode,
	buildGeneralMessage,
	buildPackageMessage,
	formatDaysLeft,
	formatMxn,
	formatMxnAmount,
	getExpressDelivery,
	getGeneralPromoCode,
	getPromoCode,
	getPromoPackage,
	getPromoStatus,
	getStartingPrice,
	getValidityNote,
	PROMO_CAMPAIGN,
} from '../../src/data/promo-campaign.data';
import { footerData } from '../../src/data/footer.data';
import { landingData } from '../../src/data/landing-page.data';
import { CLIENT_TESTIMONIALS } from '../../src/data/testimonials.data';

const DAY_MS = 86_400_000;
const campaignStart = Date.parse(PROMO_CAMPAIGN.startsAt);
const campaignEnd = Date.parse(PROMO_CAMPAIGN.endsAt);
/** A date inside the campaign, before the countdown window. */
const MID_CAMPAIGN = new Date(campaignStart + 14 * DAY_MS + DAY_MS / 2);
/** A date inside the countdown window. */
const COUNTDOWN_DAY = new Date(campaignEnd - 4.5 * DAY_MS);
/** A date after the campaign ended. */
const AFTER_CAMPAIGN = new Date(campaignEnd + DAY_MS);

const decodeWhatsAppText = (href: string | null) =>
	new URL(href ?? 'https://wa.me/').searchParams.get('text') ?? '';

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
		// The prerendered page ships the promo; pin the browser clock inside the campaign so the
		// client-side expiry never depends on the date the suite runs.
		await page.clock.setFixedTime(MID_CAMPAIGN);
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
			await expect(page.locator('.dossier-panel__module').first()).toBeVisible();
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
		await page
			.locator('[data-nav-mobile-toggle]')
			.waitFor({ state: 'attached', timeout: 5000 });
		await scrollLandingHeader(page);

		await expect(page.locator('.header-base__desktop-nav')).toBeVisible();
		// Mobile toggle is always shown on the home page (design: animated
		// hamburger for all viewports). Assert it exists and is visible.
		await expect(page.locator('[data-nav-mobile-toggle]')).toBeVisible();
		await expect(page.locator('.home-nav__link')).toHaveText(expectedNavLabels);
		await expect(page.locator('.home-nav-actions__login')).toHaveText(loginLabel);
		await expect(page.locator('.home-nav-actions__login')).toHaveAttribute('href', loginHref);
		await expect(page.locator('.home-nav-actions__cta')).toHaveAttribute('href', ctaHref);
		await expect(page.locator('.home-nav__link', { hasText: 'Nosotros' })).toHaveAttribute(
			'href',
			'#nosotros',
		);

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
			'Invitaciones digitales con pase y confirmación para cada invitado',
		);
		// The headline already names the product; the hero carries no eyebrow.
		await expect(page.locator('.hero-prime__eyebrow')).toHaveCount(0);
		await expect(page.locator('.hero-prime__subtitle')).toContainText(
			landingData.hero.subtitle,
		);
		await expect(page.locator('.hero-prime__subtitle')).toContainText(
			`Desde ${formatMxn(getStartingPrice())} MXN, pago único.`,
			{ useInnerText: true },
		);
		await expect(page.locator('.hero-prime__payment-note')).toHaveText(
			'Sin anticipo: paga al recibir su invitación terminada.',
		);
		await expect(page.locator('.hero-prime__secondary-action')).toHaveAttribute(
			'href',
			landingData.hero.secondaryCtaUrl,
		);
		const heroCta = page.locator('[data-track-cta="whatsapp-hero"]');
		await expect(heroCta).toBeVisible();
		await expect(page.locator('.hero-prime__selector')).toHaveCount(0);
		await expect(page.locator('.hero-prime .phone-mockup')).toHaveCount(0);
		await expect(page.locator('.hero-prime__proof')).toHaveCount(0);
		await expect(page.locator('#tipo-evento .event-showroom__tabs')).toBeVisible();
		await expect(
			page.locator('#tipo-evento [data-panel-event="xv"] [data-showroom-title]'),
		).toContainText('Sofía Valentina');
		await expect(
			page.locator('#tipo-evento [data-panel-event="xv"] [data-showroom-feature]'),
		).toHaveText(['RSVP', 'PASES', 'WHATSAPP']);
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

	test('uses the promo reference and structured tracking on WhatsApp CTAs', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/', { waitUntil: 'load' });

		const heroCta = page.locator('[data-track-cta="whatsapp-hero"]');
		await expect(heroCta).toHaveAttribute('data-track-event', 'whatsapp_contact_clicked');
		await expect(heroCta).toHaveAttribute('data-promo-code', getGeneralPromoCode());
		await expect(heroCta).toHaveAttribute('data-campaign-code', buildCampaignCode('HERO'));
		await expect(heroCta).toHaveAttribute('data-track-value', String(getStartingPrice()));

		const heroHref = await heroCta.getAttribute('href');
		const heroMessage = decodeWhatsAppText(heroHref);
		expect(heroMessage).toBe(buildGeneralMessage());
		expect(heroMessage).not.toContain('Cupón');
		expect(heroMessage).not.toMatch(/CM-\d+-/);

		// Outside Vercel production no rewriter runs: a click must leave the message untouched.
		const clickedHref = await heroCta.evaluate((anchor) => {
			anchor.addEventListener('click', (event) => event.preventDefault(), { once: true });
			anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			return anchor.getAttribute('href');
		});
		expect(clickedHref).toBe(heroHref);
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
		).toContainText('Boda', { ignoreCase: true });
		await expect(page.locator('[data-panel-event="boda"] [data-showroom-title]')).toContainText(
			'Mariana & Rodrigo',
		);
		await expect(eventCta).toHaveAttribute('data-event-type', 'boda');
		await expect(eventCta).toHaveAttribute('data-event-label', 'Boda');
		await expect(eventCta).not.toHaveAttribute('data-package-interest');
		await expect(eventCta).not.toHaveAttribute('data-package-name');
		await expect(eventCta).toHaveAttribute('data-promo-code', getGeneralPromoCode());
		await expect(eventCta).toHaveAttribute('data-campaign-code', buildCampaignCode('DEMO'));
		await expect(eventCta).toHaveAttribute('data-track-value', String(getStartingPrice()));
		expect(decodeWhatsAppText(await eventCta.getAttribute('href'))).toBe(buildGeneralMessage());

		const clickedHref = await eventCta.evaluate((anchor) => {
			anchor.addEventListener('click', (event) => event.preventDefault(), { once: true });
			anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			return anchor.getAttribute('href');
		});
		const clickedMessage = decodeWhatsAppText(clickedHref);
		expect(clickedMessage).toBe(buildGeneralMessage());
		expect(clickedMessage).not.toMatch(/Folio/);
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
			'La invitación también organiza su evento',
		);
		await expect(page.locator('.proof-rail-flow__item')).toHaveCount(4);
		await expect(page.locator('.proof-rail-flow__item').first()).toContainText(
			'Quién ya vio su invitación',
		);
		await expect(page.locator('#prueba-producto')).toHaveAttribute(
			'data-track-section',
			'product-proof',
		);
		await expect(page.locator('#tipo-evento')).toHaveAttribute(
			'data-track-section',
			'event-types',
		);
		await expect(
			page
				.locator('.product-proof__cta-desktop')
				.locator('[data-track-cta="whatsapp-product-proof"]'),
		).toBeVisible();
	});

	test('sends pricing CTAs directly to WhatsApp with package context', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/', { waitUntil: 'load' });
		await page.locator('#pricing').scrollIntoViewIfNeeded();

		await expect(page.locator('.pricing-note')).toContainText(getValidityNote());

		for (const [index, pkg] of PROMO_CAMPAIGN.packages.entries()) {
			const card = page.locator('.pricing-card').nth(index);
			const cta = card.locator('[data-track-cta^="pricing_"]');
			const code = getPromoCode(pkg);

			await expect(card.locator('.tier-name')).toHaveText(pkg.name);
			await expect(card.locator('.tier-price[data-promo-only] .amount')).toHaveText(
				formatMxnAmount(pkg.promoPrice),
			);
			await expect(card.locator('.regular-price s')).toContainText(
				formatMxnAmount(pkg.regularPrice),
			);
			await expect(cta).toHaveAttribute('data-track-event', 'whatsapp_contact_clicked');
			await expect(cta).toHaveAttribute('href', /wa\.me/);
			await expect(cta).toHaveAttribute(
				'data-campaign-code',
				buildCampaignCode('PRICING', code),
			);
			await expect(cta).toHaveAttribute('data-promo-code', code);
			await expect(cta).toHaveAttribute('data-package-name', pkg.name);
			await expect(cta).toHaveAttribute('data-track-value', String(pkg.promoPrice));
			expect(decodeWhatsAppText(await cta.getAttribute('href'))).toBe(
				buildPackageMessage(pkg),
			);
		}

		await expect(page.locator('.pricing-card.is-primary .tier-name')).toHaveText(
			getPromoPackage('signature').name,
		);
		await expect(page.locator('.pricing-card[data-tier="atelier"]')).toContainText(
			'sin la firma de Celebra-me',
		);
		await expect(page.locator('#pricing')).not.toContainText(/con marca|con publicidad/i);
	});

	test('adds the remaining-days countdown during the last week', async ({ page }) => {
		await page.clock.setFixedTime(COUNTDOWN_DAY);
		await page.goto('/', { waitUntil: 'load' });

		const { daysLeft, showCountdown } = getPromoStatus(COUNTDOWN_DAY);
		expect(showCountdown).toBe(true);
		await expect(page.locator('.pricing-note [data-promo-days-left]')).toHaveText(
			formatDaysLeft(daysLeft),
		);
	});

	test('hides the promo and shows regular prices once the campaign ends', async ({ page }) => {
		await page.clock.setFixedTime(AFTER_CAMPAIGN);
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/', { waitUntil: 'load' });
		await page.locator('#pricing').scrollIntoViewIfNeeded();

		await expect(page.locator('html')).toHaveAttribute('data-promo-state', 'expired');
		await expect(page.locator('.pricing-note')).toBeHidden();
		const firstCard = page.locator('.pricing-card').first();
		await expect(firstCard.locator('.tier-promo-label')).toBeHidden();
		await expect(firstCard.locator('.regular-price')).toBeHidden();
		await expect(firstCard.locator('.tier-price[data-promo-fallback] .amount')).toHaveText(
			formatMxnAmount(PROMO_CAMPAIGN.packages[0].regularPrice),
		);
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
		for (const [index, pkg] of PROMO_CAMPAIGN.packages.entries()) {
			await expect(page.locator('.pricing-card').nth(index)).toContainText(pkg.name);
		}
		await expect(page.locator('.pricing-note')).toBeVisible();
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

		for (const selector of ['#hero-title', '.hero-prime__subtitle', '.hero-prime__actions']) {
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

	test('fits a 375 px viewport with the hero CTA and pricing cards in bounds', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/', { waitUntil: 'load' });

		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
		);
		expect(overflow).toBeLessThanOrEqual(1);

		const heroCta = page.locator('[data-track-cta="whatsapp-hero"]');
		const heroBox = await heroCta.boundingBox();
		expect(heroBox).not.toBeNull();
		expect(heroBox!.x).toBeGreaterThanOrEqual(0);
		expect(heroBox!.x + heroBox!.width).toBeLessThanOrEqual(375);
		const clippedText = await heroCta.evaluate((cta) => cta.scrollWidth - cta.clientWidth);
		expect(clippedText).toBeLessThanOrEqual(1);

		await page.locator('#pricing').scrollIntoViewIfNeeded();
		// Measure against the root box so a classic desktop scrollbar does not skew the centering.
		const offsets = await page.locator('.pricing-card').evaluateAll((cards) => {
			const root = document.documentElement.getBoundingClientRect();
			return cards.map((card) => {
				const box = card.getBoundingClientRect();
				return Math.abs(box.left - root.left - (root.right - box.right));
			});
		});
		expect(offsets).toHaveLength(PROMO_CAMPAIGN.packages.length);
		for (const offset of offsets) expect(offset).toBeLessThanOrEqual(2);
	});

	test('keeps the testimonials rotator height stable across quotes', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto('/', { waitUntil: 'load' });
		await page.locator('#testimonios').scrollIntoViewIfNeeded();

		const heights = await page.locator('.testimonials__rotator').evaluate((rotator) => {
			const cards = [...rotator.querySelectorAll('.testimonials__card')];
			return cards.map((card) => {
				cards.forEach((other) =>
					other.classList.toggle('testimonials__card--active', other === card),
				);
				return Math.round(rotator.getBoundingClientRect().height);
			});
		});
		expect(heights.length).toBeGreaterThan(1);
		expect(new Set(heights).size).toBe(1);
	});

	test('loads the Playfair Display and Montserrat web fonts', async ({ page }) => {
		await page.goto('/', { waitUntil: 'load' });

		await expect
			.poll(() =>
				page.evaluate(async () => {
					await document.fonts.ready;
					return [...document.fonts]
						.filter((face) => face.status === 'loaded')
						.map((face) => face.family.replace(/["']/g, ''));
				}),
			)
			.toEqual(
				expect.arrayContaining([
					expect.stringMatching(/Playfair Display/),
					expect.stringMatching(/Montserrat/),
				]),
			);
	});

	test('publishes the legal pages without placeholders and with the service terms', async ({
		page,
	}) => {
		await page.goto('/privacidad', { waitUntil: 'load' });
		const privacy = await page.locator('.legal-page').innerText();
		expect(privacy).not.toContain('[');
		expect(privacy).toContain('Francisco Mendoza');
		expect(privacy).toContain('contacto@celebra-me.com');

		await page.goto('/terminos', { waitUntil: 'load' });
		const terms = page.locator('.legal-page');
		await expect(terms).toContainText('No solicitamos anticipo');
		await expect(terms).toContainText('Invitado de prueba');
		await expect(terms).toContainText('3 a 5 días hábiles');
		await expect(terms).toContainText(formatMxn(getExpressDelivery().price));
	});

	test('shows real social links, contact details and a full-width copyright row', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/', { waitUntil: 'load' });
		const footer = page.locator('.footer-section');
		await footer.scrollIntoViewIfNeeded();

		const socialHrefs = await footer
			.locator('.social-link')
			.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
		expect(socialHrefs).toEqual(footerData.socialLinks?.links.map((link) => link.href));
		await expect(footer.locator('.footer-contact')).toContainText(footerData.contact!.email);
		await expect(footer.locator('.footer-contact')).toContainText(footerData.contact!.city);
		await expect(footer.locator('[data-track-cta="footer_whatsapp"]')).toHaveAttribute(
			'data-campaign-code',
			buildCampaignCode('FOOTER'),
		);

		const rowWidths = await footer.evaluate((element) => {
			const containers = element.querySelectorAll('.container');
			const bottom = element.querySelector('.footer-bottom');
			return {
				container: containers[0]?.getBoundingClientRect().width ?? 0,
				bottom: bottom?.getBoundingClientRect().width ?? 0,
			};
		});
		// The copyright row spans the same width as the link columns above it.
		expect(rowWidths.bottom).toBeGreaterThan(rowWidths.container * 0.9);
		await expect(footer.locator('.footer-link--cookie')).toHaveCSS('cursor', 'pointer');
	});

	test('uses one primary WhatsApp label and tracks every quote CTA', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto('/', { waitUntil: 'load' });

		const labels = await page
			.locator(
				'main [data-track-event="whatsapp_contact_clicked"]:not([data-track-cta="whatsapp-sticky"]):not([data-track-cta="footer_whatsapp"])',
			)
			.evaluateAll((links) => links.map((link) => link.getAttribute('data-track-label')));
		expect(labels.length).toBeGreaterThan(5);
		expect(new Set(labels)).toEqual(new Set(['Cotizar por WhatsApp']));

		const guestCta = page.locator(
			'#experiencia-invitados [data-track-event="whatsapp_contact_clicked"]',
		);
		await expect(guestCta).toHaveAttribute('data-track-cta', 'whatsapp-guest-experience');
		await expect(guestCta).toHaveAttribute('data-track-section', 'guest-experience');
		await expect(guestCta).toHaveAttribute('data-campaign-code', buildCampaignCode('GUESTS'));
		await expect(guestCta).toHaveAttribute('data-promo-code', getGeneralPromoCode());
		await expect(guestCta).toContainText('Cotizar por WhatsApp');
	});

	test('shows the sticky WhatsApp bar after the hero and hides it over the contact form', async ({
		page,
	}) => {
		await page.addInitScript(() => {
			window.localStorage.setItem(
				'cm_consent',
				JSON.stringify({
					necessary: true,
					analytics: false,
					marketing: false,
					updatedAt: new Date().toISOString(),
				}),
			);
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/', { waitUntil: 'load' });

		const bar = page.locator('[data-sticky-cta]');
		const cta = bar.locator('[data-track-cta="whatsapp-sticky"]');
		await expect(bar).not.toHaveClass(/sticky-cta--visible/);
		await expect(cta).toHaveAttribute('data-campaign-code', buildCampaignCode('STICKY'));

		await page.locator('#pricing').scrollIntoViewIfNeeded();
		await expect(bar).toHaveClass(/sticky-cta--visible/);
		await expect(cta).toContainText(`WhatsApp · desde ${formatMxn(getStartingPrice())}`, {
			useInnerText: true,
		});

		await page.locator('#contacto .contact-form-wrapper').scrollIntoViewIfNeeded();
		await expect(bar).not.toHaveClass(/sticky-cta--visible/);
	});

	test('keeps the sticky bar clear of the cookie banner and off desktop', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/', { waitUntil: 'load' });
		await expect(page.locator('#consent-banner-bar')).toBeVisible();

		const bar = page.locator('[data-sticky-cta]');
		await page.locator('#pricing').scrollIntoViewIfNeeded();
		await expect(bar).not.toHaveClass(/sticky-cta--visible/);

		// The Astro dev toolbar can overlap the banner buttons on narrow viewports in dev mode.
		await page.locator('#consent-reject').evaluate((button) => (button as HTMLElement).click());
		await expect(page.locator('#consent-banner-bar')).toBeHidden();
		await expect(bar).toHaveClass(/sticky-cta--visible/);

		await page.setViewportSize({ width: 1280, height: 900 });
		await expect(bar).toBeHidden();
	});

	test('shows anonymous client testimonials with the privacy notice', async ({ page }) => {
		await page.goto('/', { waitUntil: 'load' });
		const section = page.locator('#testimonios');

		await expect(section.locator('.testimonials__card')).toHaveCount(
			CLIENT_TESTIMONIALS.length,
		);
		await expect(section.locator('.testimonials__card').first()).toContainText(
			CLIENT_TESTIMONIALS[0].text,
		);
		await expect(section.locator('.testimonials__footer').first()).toContainText(
			CLIENT_TESTIMONIALS[0].role,
		);
		await expect(section.locator('.testimonials__notice')).toHaveText(
			'Testimonios reales de clientes. Omitimos sus nombres por privacidad.',
		);
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

		await page.goto('/#nosotros', { waitUntil: 'load' });
		await sectionHeaderIsBelowStickyHeader(page, '#nosotros .contact-about__title');
	});
});
