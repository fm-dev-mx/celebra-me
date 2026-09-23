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
	{ name: '440x956', width: 440, height: 956 },
	{ name: '768x1024', width: 768, height: 1024 },
	{ name: '1440x900', width: 1440, height: 900 },
	{ name: '1440x600', width: 1440, height: 600 },
] as const;

async function expectStableInvitation(
	page: import('@playwright/test').Page,
	expectedSectionCount = 9,
) {
	await page.evaluate(() => document.fonts.ready);
	await prepareCompletePage(page);
	await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
	await expect(page.locator('#test-invitation-root.event--melissa-y-luis-osmar')).toBeVisible();
	// Personalized access is rendered inside the RSVP chapter, so the DOM has
	// nine section wrappers plus the cathedral interlude minus that nested plan item.
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
		const date = hero.querySelector('.ceremonial-portrait-hero__date')!;
		const cue = hero.querySelector('.ceremonial-portrait-hero__scroll-indicator')!;
		return {
			dateBottom: date.getBoundingClientRect().bottom,
			cueTop: cue.getBoundingClientRect().top,
			cueBottom: cue.getBoundingClientRect().bottom,
			heroBottom: hero.getBoundingClientRect().bottom,
			landscape: getComputedStyle(hero, '::after').backgroundImage,
		};
	});
	expect(opening.landscape).toBe('none');
	expect(opening.dateBottom).toBeLessThanOrEqual(opening.cueTop);
	expect(opening.cueBottom).toBeLessThanOrEqual(opening.heroBottom + 1);
	await expect(page.locator('.invitation-interlude')).toHaveCount(1);
	await expect(page.locator('.invitation-interlude__image')).toHaveAttribute('alt', /catedral/);
	await expect(page.locator('.quote-author')).toHaveCount(0);
	await expect(page.locator('.quote-divider-top')).toBeHidden();
	await expect(page.locator('.quote-divider-bottom')).toBeVisible();
	await expect(page.locator('.ceremonial-portrait-hero__paper')).toHaveCSS('box-shadow', 'none');
	await expect(page.locator('.itinerary__container')).toHaveCSS(
		'background-color',
		'rgb(247, 243, 237)',
	);
	const programContrast = await page.locator('.itinerary__container').evaluate((panel) => {
		const luminance = (color: string) =>
			color
				.match(/[\d.]+/g)!
				.slice(0, 3)
				.map(Number)
				.map((channel) => {
					const value = channel / 255;
					return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
				})
				.reduce(
					(sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index],
					0,
				);
		const paper = luminance(getComputedStyle(panel).backgroundColor);
		return [
			'.itinerary__title',
			'.itinerary__subtitle',
			'.itinerary__item-time',
			'.itinerary__item-label',
			'.itinerary__item-description',
		].map((selector) => {
			const ink = luminance(getComputedStyle(panel.querySelector(selector)!).color);
			return {
				selector,
				ratio: (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05),
			};
		});
	});
	for (const { selector, ratio } of programContrast) {
		expect(ratio, selector).toBeGreaterThanOrEqual(4.5);
	}
	for (const decoration of await page
		.locator('.itinerary__item-icon-wrapper, .gift-card__icon-medallion')
		.all()) {
		await expect(decoration).toBeHidden();
	}
	await expect(page.locator('.event-location__card-map-preview-art').first()).toBeVisible();

	await expect(page.locator('.quote-line')).toHaveText([
		'Dicen que cuando encuentras a la persona correcta, el corazón lo sabe.',
		'Nosotros lo supimos y por eso queremos celebrar nuestro amor rodeados de las personas más importantes de nuestras vidas.',
	]);
	await expect(page.locator('.itinerary__item-label')).toHaveText([
		'Ceremonia religiosa',
		'Recepción / cóctel de bienvenida',
		'Ceremonia civil',
		'Fiesta',
	]);
	await expect(page.locator('.itinerary__item-time')).toHaveText([
		'12:00 PM',
		'2:00 PM',
		'3:00 PM',
		'5:00 PM',
	]);
	for (const time of await page.locator('.itinerary__item-time').all()) {
		const lines = await time.evaluate((element) => {
			const range = document.createRange();
			range.selectNodeContents(element);
			return range.getClientRects().length;
		});
		expect(lines).toBe(1);
	}
	await expect(page.locator('.itinerary__item-description').last()).toHaveText(
		'Belcanto Jardín.',
	);
	await expect(
		page.locator('.itinerary__item').last().locator('.itinerary__item-description'),
	).toHaveCount(0);
	const boundary = await page.locator('.gifts-section').evaluate((gifts) => {
		const itinerary = document.querySelector('.itinerary')!;
		return {
			gap: gifts.getBoundingClientRect().top - itinerary.getBoundingClientRect().bottom,
			padding: parseFloat(getComputedStyle(itinerary).paddingBottom),
		};
	});
	expect(Math.abs(boundary.gap)).toBeLessThanOrEqual(1);
	expect(boundary.padding).toBe(0);
}

async function expectContentContainersToReflow(page: import('@playwright/test').Page) {
	const overflow = await page.evaluate(() => {
		const selectors = [
			// The open hero deliberately lets decorative pseudo-elements extend beyond its paper.
			'.ceremonial-portrait-hero__content',
			'.ceremonial-portrait-hero__name',
			'.quote-content',
			'.quote-line',
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
	test('keeps the unconfigured editorial ledger open and text-only across presets', async ({
		page,
	}) => {
		for (const preset of ['jewelry-box', 'jewelry-box-wedding']) {
			for (const width of [320, 1440]) {
				await page.setViewportSize({ width, height: 900 });
				await page.goto(
					`/test/variant?section=itinerary&variant=editorial-ledger&preset=${preset}`,
				);
				const panel = page.locator('.itinerary__container');
				await expect(panel).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
				await expect(panel).toHaveCSS('padding-top', '0px');
				await expect(panel).toHaveCSS('box-shadow', 'none');
				await expect(page.locator('.itinerary__item-icon-wrapper').first()).toBeHidden();
			}
		}
	});

	test('preserves unconfigured formal chapter typography and surface across presets', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		for (const preset of ['jewelry-box', 'jewelry-box-wedding']) {
			await page.goto(
				`/test/variant?section=personalizedAccess&variant=formal-pass&preset=${preset}`,
			);
			await expect(page.locator('.access-card__seal')).toBeVisible();
			await expect(page.locator('.access-card')).toHaveCSS('border-radius', '14px');
			await expect(page.locator('.access-card__guest')).toHaveCSS('font-size', '52px');
			await expect(page.locator('.access-card__count')).toHaveCSS('font-size', '88px');
			await page.goto(`/test/variant?section=rsvp&variant=formal-register&preset=${preset}`);
			await expect(page.locator('.rsvp__title')).toHaveCSS('font-size', '52px');
			await expect(page.locator('.rsvp-section').first()).toHaveCSS('padding-top', '54px');
		}
	});

	for (const viewport of viewports) {
		test(`renders the complete invitation at ${viewport.name}`, async ({ page }) => {
			await page.setViewportSize(viewport);
			const response = await page.goto(invitationUrl, { waitUntil: 'load' });
			expect(response?.status()).toBe(200);
			await expectStableInvitation(page);
			const rhythm = await page.evaluate(() => {
				const bounds = (selector: string) =>
					document.querySelector(selector)!.getBoundingClientRect();
				const familyBottom = Math.max(
					bounds('.family__group--group-0').bottom,
					bounds('.family__group--group-1').bottom,
				);
				return {
					familyGap: bounds('.family__group--godparents').top - familyBottom,
					timerGap:
						bounds('.countdown-invitation-text').top -
						bounds('.countdown__timer').bottom,
				};
			});
			expect(rhythm.familyGap).toBeGreaterThanOrEqual(24);
			expect(rhythm.familyGap).toBeLessThanOrEqual(64);
			await expect(page.locator('.countdown-date')).toBeHidden();
			expect(rhythm.timerGap).toBeGreaterThanOrEqual(16);
			expect(rhythm.timerGap).toBeLessThanOrEqual(48);
			if (viewport.width === 1440) {
				const parentColumn = await page.locator('.family__group--group-1').boundingBox();
				const godparentColumn = await page
					.locator('.family__group--godparents .family__item')
					.nth(1)
					.boundingBox();
				expect(Math.abs(parentColumn!.x - godparentColumn!.x)).toBeLessThanOrEqual(1);
			}
			for (const selector of ['.family']) {
				const section = await page.locator(selector).boundingBox();
				expect(section!.height).toBeGreaterThanOrEqual(viewport.height - 1);
			}
			const quoteBox = await page.locator('.quote-section').boundingBox();
			const countdownBox = await page.locator('.countdown-section').boundingBox();
			expect(quoteBox!.height + countdownBox!.height).toBeGreaterThanOrEqual(
				viewport.height - 1,
			);
			const crest = page.locator('.ceremonial-portrait-hero__crest');
			await expect(crest).toHaveAttribute('aria-hidden', 'true');
			await expect(crest).toBeHidden();
			await expect(page.locator('.ceremonial-portrait-hero__date')).toHaveCSS('opacity', '1');
			const timerColumns = await page.locator('.countdown__timer').evaluate(
				(element) =>
					getComputedStyle(element)
						.gridTemplateColumns.split(' ')
						.filter((track) => parseFloat(track) > 0).length,
			);
			expect(timerColumns).toBe(3);
			for (const label of await page.locator('.countdown__label').all()) {
				const lines = await label.evaluate((element) => {
					const range = document.createRange();
					range.selectNodeContents(element);
					return range.getClientRects().length;
				});
				expect(lines).toBe(1);
			}
			const hero = page.locator('.ceremonial-portrait-hero');
			const heroBox = await hero.boundingBox();
			expect(heroBox!.height).toBeGreaterThanOrEqual(viewport.height - 2);
			const landscape = await hero.evaluate(
				(element) => getComputedStyle(element, '::after').backgroundImage,
			);
			expect(landscape).toBe('none');
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
		{ name: '1440x600', width: 1440, height: 600 },
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
			const nameLines = await page
				.locator('.ceremonial-portrait-hero__name span')
				.first()
				.evaluate((name) => {
					const range = document.createRange();
					range.selectNodeContents(name);
					return range.getClientRects().length;
				});
			expect(nameLines).toBe(1);
			await page.screenshot({
				path: path.join(
					process.cwd(),
					'.tmp',
					'visual-review',
					'melissa-y-luis-osmar',
					`${viewport.name}-text-200.png`,
				),
				fullPage: true,
				animations: 'disabled',
			});
		});
	}

	test('keeps three-digit live countdown values contained at narrow widths', async ({ page }) => {
		await page.clock.setFixedTime(new Date('2026-08-01T19:37:17Z'));
		for (const width of [320, 390]) {
			await page.setViewportSize({ width, height: 844 });
			await page.goto(
				`${invitationUrl.replace('&screenshot=true', '')}&envelope=1&skipEnvelope=true`,
			);
			await prepareCompletePage(page);
			await expect(page.locator('.countdown__value').first()).toHaveText('136');
			for (const value of await page.locator('.countdown__value').all()) {
				const geometry = await value.evaluate((element) => {
					const range = document.createRange();
					range.selectNodeContents(element);
					const text = range.getBoundingClientRect();
					const segment = element.closest('.countdown__segment')!.getBoundingClientRect();
					return {
						lines: range.getClientRects().length,
						left: text.left - segment.left,
						right: segment.right - text.right,
					};
				});
				expect(geometry.lines).toBe(1);
				expect(geometry.left).toBeGreaterThanOrEqual(0);
				expect(geometry.right).toBeGreaterThanOrEqual(0);
			}
		}
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

	test('copies the original addresses and gift number without following external links', async ({
		page,
		context,
	}) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.goto(invitationUrl);
		await expectStableInvitation(page);
		const addresses = [
			'21 de Marzo, Centro, 82000 Mazatlán, Sinaloa',
			'Lib. 3 12100, Valle del Ejido, 82129 Mazatlán, Sinaloa',
		];
		for (const [index, address] of addresses.entries()) {
			await page.locator('.event-location__card-content-copy-button').nth(index).click();
			await expect
				.poll(() => page.evaluate(() => navigator.clipboard.readText()))
				.toBe(address);
		}
		await page.locator('.gift-card .copy-icon-button').click();
		await expect
			.poll(() => page.evaluate(() => navigator.clipboard.readText()))
			.toBe('60019030');
		await expect(
			page.locator('.event-location__card-map-preview--link').first(),
		).toHaveAttribute('href', 'https://maps.app.goo.gl/fDfSjGhYbnG8FmYz8');
		await expect(
			page.locator('.event-location__card-map-preview--link').last(),
		).toHaveAttribute('href', 'https://maps.app.goo.gl/thY2JoawdYj1vkbx8');
		await expect(page.locator('.gift-card__button')).toHaveAttribute(
			'href',
			'https://mesaderegalos.liverpool.com.mx/eventodebusqueda',
		);
	});

	for (const width of [320, 390, 1440]) {
		test(`opens by keyboard and keeps music clear of the header and date at ${width}px`, async ({
			page,
		}) => {
			await page.setViewportSize({ width, height: 800 });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			// Exercise the real player UI without fetching or playing remote audio.
			await page.addInitScript(() => {
				HTMLMediaElement.prototype.play = async () => {};
				HTMLMediaElement.prototype.pause = () => {};
			});
			await page.route('**/*.mp3', (route) => route.abort());
			await page.goto(
				`${invitationUrl.replace('&screenshot=true', '').replace('&animations=off', '')}&envelope=1&music=1`,
			);
			await expect(
				page.getByRole('button', { name: 'Abrir sobre de la invitación', exact: true }),
			).toBeEnabled();
			await page
				.getByRole('button', { name: 'Abrir sobre de la invitación', exact: true })
				.press('Enter');
			await expect(page.locator('#test-invitation-root')).toHaveAttribute(
				'data-reveal-state',
				'revealed',
			);
			await page.locator('html').evaluate((root) => {
				root.style.fontSize = '200%';
			});
			const toggle = page.locator('[data-music-toggle]');
			await expect(toggle).toHaveAttribute('aria-label', 'Pausar música');
			await toggle.focus();
			await expect(toggle).toHaveCSS('outline-style', 'solid');
			await toggle.press('Enter');
			await expect(toggle).toHaveAttribute(
				'aria-label',
				'A Thousand Years — Christina Perri',
			);
			await toggle.press('Enter');
			await expect(toggle).toHaveAttribute('aria-label', 'Pausar música');
			const control = await toggle.boundingBox();
			expect(control!.width).toBeGreaterThanOrEqual(44);
			expect(control!.height).toBeGreaterThanOrEqual(44);
			for (const selector of [
				'.event-header__title',
				'.ceremonial-portrait-hero__date',
				...(width < 1024 ? ['.header-base__mobile-toggle'] : []),
			]) {
				const content = await page.locator(selector).evaluate((element) => {
					if (element.classList.contains('ceremonial-portrait-hero__date')) {
						const range = document.createRange();
						range.selectNodeContents(element);
						return range.getBoundingClientRect().toJSON();
					}
					return element.getBoundingClientRect().toJSON();
				});
				const intersects =
					control!.x < content!.x + content!.width &&
					control!.x + control!.width > content!.x &&
					control!.y < content!.y + content!.height &&
					control!.y + control!.height > content!.y;
				expect(intersects, selector).toBe(false);
			}
			if (width < 1024) {
				const menu = page.getByRole('button', { name: 'Abrir menú', exact: true });
				await expect(menu).toHaveCSS('color', 'rgb(58, 49, 44)');
				await menu.press('Enter');
				await expect(page.locator('.header-base__mobile-toggle')).toHaveAttribute(
					'aria-expanded',
					'true',
				);
				await page.keyboard.press('Escape');
				await expect(page.locator('.header-base__mobile-toggle')).toHaveAttribute(
					'aria-expanded',
					'false',
				);
			}
			await page.screenshot({
				path: `.tmp/visual-review/melissa-y-luis-osmar/controls-${width}-text-200.png`,
				animations: 'disabled',
			});
		});
	}

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
			await expectStableInvitation(page, 10);
			await expectContentContainersToReflow(page);
			const pass = page.locator('.personalized-access');
			await expect(pass).toHaveAttribute('data-presentation', 'admission-ticket');
			await expect(pass.locator('.access-card__signature')).toHaveText(
				'Melissa & Luis Osmar',
			);
			await expect(pass.locator('.access-card__welcome')).toHaveText(
				'Será un placer celebrar con usted.',
			);
			await expect(pass.locator('.access-card__note')).toHaveCount(0);
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
		const apiWrites: string[] = [];
		await page.route('**/api/**', async (route) => {
			if (route.request().method() !== 'GET') {
				apiWrites.push(route.request().url());
				await route.abort();
			} else await route.continue();
		});
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
		await expect(page.locator('.rsvp__notes-label')).toHaveCSS('color', 'rgb(255, 253, 249)');
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
		await expect(page.locator('#rsvp-form button[type="submit"]')).toBeDisabled();
		await expect(page.getByText('Confirmación recibida, María Fernanda Solís.')).toBeVisible({
			timeout: 3_000,
		});
		await page
			.locator('.rsvp-section')
			.first()
			.screenshot({ path: '.tmp/visual-review/melissa-y-luis-osmar/rsvp-confirmed.png' });
		expect(apiWrites).toEqual([]);
	});

	test('shows a declined response without persistence', async ({ page }) => {
		const writes: string[] = [];
		await page.route('**/api/**', async (route) => {
			if (route.request().method() !== 'GET') {
				writes.push(route.request().url());
				await route.abort();
			} else await route.continue();
		});
		await page.goto(
			`${invitationUrl}&guestSeats=1&guestName=Mar%C3%ADa%20Fernanda%20Sol%C3%ADs`,
		);
		await page.locator('.rsvp-section').first().scrollIntoViewIfNeeded();
		await expect(
			page.locator('.invitation-section-wrapper[data-section-kind="rsvp"] astro-island'),
		).not.toHaveAttribute('ssr');
		await expect(page.locator('#rsvp-form')).toBeVisible();
		await page
			.locator('#attendance-no')
			.evaluate((input) => (input as HTMLInputElement).click());
		await page.locator('#rsvp-form button[type="submit"]').click();
		await expect(page.getByText('Registramos su aviso, María Fernanda Solís.')).toBeVisible();
		expect(writes).toEqual([]);
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
