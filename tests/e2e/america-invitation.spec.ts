import { expect, test, type Page } from '@playwright/test';

// Authoring guard for /xv/america: the published copy, the date, the program, and the two guest
// interactions that must keep working (the RSVP reply and the venue map/calendar links). The page
// renders from the managed definition through the variant harness; the RSVP runs in demo mode, so
// every non-GET API call is aborted and must never happen.
const invitationUrl =
	'/test/variant?full=1&presentation=1&eventType=xv&slug=america&screenshot=true&animations=off';
const personalizedUrl = `${invitationUrl}&guestSeats=2&guestName=${encodeURIComponent('Lucía Ramírez')}`;

const CHURCH_MAPS_URL =
	'https://www.google.com/maps/search/?api=1&query=Parroquia+Cristo+Rey+San+Francisco+y+Oaxaca+Colonia+Estrella+Los+Mochis+Sinaloa';
const GARDEN_MAPS_URL =
	'https://www.google.com/maps/search/?api=1&query=Jard%C3%ADn+Los+Mangos+Carretera+Los+Mochis+Topolobampo+9+de+Diciembre';

async function blockApiWrites(page: Page): Promise<string[]> {
	const writes: string[] = [];
	await page.route('**/api/**', async (route) => {
		if (route.request().method() !== 'GET') {
			writes.push(route.request().url());
			await route.abort();
		} else await route.continue();
	});
	return writes;
}

async function openReplyCard(page: Page) {
	const rsvp = page.locator('.invitation-section-wrapper[data-section-kind="rsvp"]');
	await rsvp.scrollIntoViewIfNeeded();
	await expect(rsvp.locator('astro-island').first()).not.toHaveAttribute('ssr');
	await expect(page.locator('#rsvp-form')).toBeVisible();
	return rsvp;
}

test.describe('America XV invitation content', () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(invitationUrl, { waitUntil: 'load' });
		await expect(page.locator('#test-invitation-root.event--america')).toBeVisible();
	});

	test('keeps the chapter order of the album', async ({ page }) => {
		const kinds = await page
			.locator('.invitation-section-wrapper[data-section-kind]')
			.evaluateAll((elements) =>
				elements.map((element) => (element as HTMLElement).dataset.sectionKind),
			);
		expect(kinds).toEqual([
			'quote',
			'family',
			'interlude',
			'countdown',
			'interlude',
			'location',
			'itinerary',
			'gallery',
			'gifts',
			'rsvp',
			'thankYou',
		]);
	});

	test('shows the name, the date and the first venue on the cover', async ({ page }) => {
		const hero = page.locator('.invitation-hero');
		await expect(page.locator('h1')).toHaveText('América');
		await expect(hero).toContainText('Mis XV años');
		await expect(hero).toContainText('sábado 21 de noviembre de 2026');
		await expect(hero).toContainText('a las seis de la tarde');
		await expect(hero).toContainText('Parroquia Cristo Rey');
		await expect(
			page.locator('.invitation-section-wrapper[data-section-kind="countdown"]'),
		).toContainText('sábado 21 de noviembre de 2026');
	});

	test('lists the five moments of the program in order', async ({ page }) => {
		const itinerary = page.locator(
			'.invitation-section-wrapper[data-section-kind="itinerary"]',
		);
		await expect(itinerary).toContainText('Así será mi noche');
		const rows = itinerary.locator('.itinerary__program-row');
		await expect(rows).toHaveCount(5);
		const expected = [
			[/6:00\s*PM|18:00/, 'Misa'],
			[/8:00\s*PM|20:00/, 'Recepción'],
			[/8:30\s*PM|20:30/, 'Vals'],
			[/9:30\s*PM|21:30/, 'Cena'],
			[/1:00\s*AM|01:00/, 'Cierre'],
		] as const;
		for (const [index, [time, label]] of expected.entries()) {
			await expect(rows.nth(index)).toContainText(time);
			await expect(rows.nth(index)).toContainText(label);
		}
	});

	test('names both venues, the gifts note and the closing message', async ({ page }) => {
		const location = page.locator('.invitation-section-wrapper[data-section-kind="location"]');
		await expect(location).toContainText('Parroquia Cristo Rey');
		await expect(location).toContainText('Jardín Los Mangos');
		await expect(
			page.locator('.invitation-section-wrapper[data-section-kind="gifts"]'),
		).toContainText('puede ser un regalo o en efectivo');
		await expect(
			page.locator('.invitation-section-wrapper[data-section-kind="gallery"]'),
		).toContainText('Mis cuatro looks');
		await expect(
			page.locator('.invitation-section-wrapper[data-section-kind="thankYou"]'),
		).toContainText('Lo demás se lo cuento el 21 de noviembre… en persona.');
	});
});

// The cover date never wraps, so it is the first text to run past a narrow letter column. The
// sizes cover phones held upright and sideways, the side-by-side layout near its 62rem breakpoint
// and wide desktops. The body is the page's scroller and draws its own scrollbar, so the visible
// width is the narrower of the root and the body.
const coverViewports = [
	{ width: 390, height: 844 },
	{ width: 720, height: 900 },
	{ width: 720, height: 450 },
	{ width: 720, height: 500 },
	{ width: 667, height: 375 },
	{ width: 992, height: 768 },
	{ width: 1024, height: 768 },
	{ width: 1199, height: 1200 },
	{ width: 1280, height: 800 },
	{ width: 1440, height: 900 },
];

test.describe('America XV invitation cover', () => {
	for (const viewport of coverViewports) {
		test(`keeps every cover text inside the screen at ${viewport.width}x${viewport.height}`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			await page.goto(invitationUrl, { waitUntil: 'load' });
			await page.evaluate(() => document.fonts.ready);
			const overflowing = await page.locator('.invitation-hero').evaluate((hero) => {
				const visibleWidth = Math.min(
					document.documentElement.clientWidth,
					document.body.clientWidth,
				);
				const found: string[] = [];
				const walker = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT);
				while (walker.nextNode()) {
					const text = walker.currentNode;
					if (!text.textContent?.trim()) continue;
					const range = document.createRange();
					range.selectNodeContents(text);
					for (const rect of range.getClientRects()) {
						if (rect.right > visibleWidth + 0.5 || rect.left < -0.5) {
							found.push(`${text.textContent.trim()} (${Math.round(rect.right)}px)`);
						}
					}
				}
				const date = hero.querySelector('.framed-portrait-hero__when');
				const column = date?.parentElement?.getBoundingClientRect();
				if (date && column && date.getBoundingClientRect().right > column.right + 0.5) {
					found.push(`${date.textContent?.trim()} leaves its column`);
				}
				return found;
			});
			expect(overflowing).toEqual([]);
			await expect(page.locator('.framed-portrait-hero__when').first()).toContainText(
				'sábado 21 de noviembre de 2026',
			);
		});
	}
});

test.describe('America XV invitation interactions', () => {
	test('keeps the reply card closed without a personal link', async ({ page }) => {
		const writes = await blockApiWrites(page);
		await page.goto(invitationUrl, { waitUntil: 'load' });
		const rsvp = page.locator('.invitation-section-wrapper[data-section-kind="rsvp"]');
		await expect(rsvp).toContainText('¿Me acompaña?');
		await expect(rsvp).toContainText('utilice el enlace exclusivo');
		await expect(page.locator('#rsvp-form')).toHaveCount(0);
		expect(writes).toEqual([]);
	});

	test('confirms attendance on a personal link without sending anything', async ({ page }) => {
		const writes = await blockApiWrites(page);
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(personalizedUrl, { waitUntil: 'load' });
		const rsvp = await openReplyCard(page);
		await expect(rsvp).toContainText('Avíseme antes del viernes 6 de noviembre');

		await page
			.locator('#attendance-yes')
			.evaluate((input) => (input as HTMLInputElement).click());
		const guestCount = page.locator('#guestCount');
		await expect(guestCount).toBeVisible();
		await expect(rsvp).toContainText('Máx. 2');

		await guestCount.fill('3');
		await page.locator('#rsvp-form button[type="submit"]').click();
		await expect(page.getByRole('alert')).toBeVisible();

		await guestCount.fill('2');
		await page.locator('#rsvp-form button[type="submit"]').click();
		await expect(rsvp).toContainText('¡Qué emoción,', { timeout: 3_000 });
		await expect(rsvp).toContainText(
			'Ya está: ese lugar es suyo. Nos vemos el sábado 21 de noviembre.',
		);
		expect(writes).toEqual([]);
	});

	test('records a declined reply on a personal link without sending anything', async ({
		page,
	}) => {
		const writes = await blockApiWrites(page);
		await page.goto(personalizedUrl, { waitUntil: 'load' });
		const rsvp = await openReplyCard(page);
		await page
			.locator('#attendance-no')
			.evaluate((input) => (input as HTMLInputElement).click());
		await page.locator('#rsvp-form button[type="submit"]').click();
		await expect(rsvp).toContainText('Le voy a extrañar,', { timeout: 3_000 });
		await expect(rsvp).toContainText('Gracias por avisarme.');
		expect(writes).toEqual([]);
	});

	test('opens each venue in Google Maps in a new tab', async ({ page, context }) => {
		await context.route(/^https:\/\/www\.google\.com\//, (route) =>
			route.fulfill({ status: 200, contentType: 'text/plain', body: 'maps' }),
		);
		await page.goto(invitationUrl, { waitUntil: 'load' });
		const links = page.locator(
			'.invitation-section-wrapper[data-section-kind="location"] a[href*="google.com/maps"]',
		);
		await expect(links).toHaveCount(2);
		await expect(links.nth(0)).toHaveAttribute('href', CHURCH_MAPS_URL);
		await expect(links.nth(1)).toHaveAttribute('href', GARDEN_MAPS_URL);
		for (const link of await links.all()) {
			await expect(link).toHaveAttribute('target', '_blank');
			await expect(link).toHaveAttribute('rel', /noopener/);
		}

		await links.first().scrollIntoViewIfNeeded();
		const [popup] = await Promise.all([context.waitForEvent('page'), links.first().click()]);
		await expect.poll(() => popup.url()).toBe(CHURCH_MAPS_URL);
	});

	test('opens the calendar menu of the first venue with readable choices', async ({ page }) => {
		await page.goto(invitationUrl, { waitUntil: 'load' });
		const menu = page
			.locator(
				'.invitation-section-wrapper[data-section-kind="location"] details.event-location__calendar',
			)
			.first();
		await menu.scrollIntoViewIfNeeded();
		await expect(menu).not.toHaveAttribute('open');
		await menu.locator('summary').click();
		await expect(menu).toHaveAttribute('open');
		const options = menu.locator('.event-location__calendar-options a');
		await expect(options).toHaveCount(3);
		await expect(options.nth(0)).toBeVisible();
		await expect(options.nth(0)).toHaveAttribute('href', /calendar\.google\.com/);
		await expect(options.nth(0)).toHaveAttribute('href', /20261122T010000Z/);
		await expect(options.nth(1)).toHaveAttribute('download', /\.ics$/);
	});
});
