import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
	{ name: 'mobile-standard', width: 390, height: 844 },
	{ name: 'desktop', width: 1440, height: 900 },
] as const;

const ARTIFACT_ROOT = path.resolve(process.cwd(), 'temp', 'renata-audit-screenshots');
const FOREIGN_CONTENT =
	/Daniela|Martín|Huejutla|Abril Michelle|Victoria y Roberto|Romina|Amazon|D·M|¿Podrán acompañarnos\?/i;

type CountdownArchitecture = {
	variant: string | null;
	segmentCount: number;
	firstRowCount: number;
	titleFontSize: string;
	titleLetterSpacing: string;
	titleMarginBottom: string;
	timerGap: string;
	timerMarginTop: string;
	segmentPadding: string;
	segmentRadius: string;
	segmentBorderWidth: string;
	valueFontSize: string;
	labelFontSize: string;
	labelLetterSpacing: string;
	footerMarginTop: string;
	dateLetterSpacing: string;
	sectionPaddingBlock: string;
	sectionMinHeight: string;
};

function measureCountdownArchitecture(node: Element): CountdownArchitecture {
	const styleOf = (selector: string) => {
		const el = node.querySelector(selector);
		if (!el) throw new Error(`Missing ${selector}`);
		return getComputedStyle(el);
	};
	const title = styleOf('.countdown-title');
	const timer = styleOf('.countdown__timer');
	const segment = styleOf('.countdown__segment');
	const value = styleOf('.countdown__value');
	const label = styleOf('.countdown__label');
	const footer = styleOf('.countdown-invitation-text');
	const date = styleOf('.countdown-date .event-date');
	const section = getComputedStyle(node);
	const segments = [...node.querySelectorAll('.countdown__segment')];
	const firstRowTop = segments[0]?.getBoundingClientRect().top ?? 0;
	return {
		variant: node.getAttribute('data-variant'),
		segmentCount: segments.length,
		firstRowCount: segments.filter(
			(item) => Math.abs(item.getBoundingClientRect().top - firstRowTop) < 2,
		).length,
		titleFontSize: title.fontSize,
		titleLetterSpacing: title.letterSpacing,
		titleMarginBottom: title.marginBottom,
		timerGap: timer.gap,
		timerMarginTop: timer.marginTop,
		segmentPadding: segment.padding,
		segmentRadius: segment.borderRadius,
		segmentBorderWidth: segment.borderWidth,
		valueFontSize: value.fontSize,
		labelFontSize: label.fontSize,
		labelLetterSpacing: label.letterSpacing,
		footerMarginTop: footer.marginTop,
		dateLetterSpacing: date.letterSpacing,
		sectionPaddingBlock: `${section.paddingTop} ${section.paddingBottom}`,
		sectionMinHeight: section.minHeight,
	};
}

async function assertRenataLeakScan(page: Page) {
	const pageText = await page.locator('body').innerText();
	expect(pageText).not.toMatch(FOREIGN_CONTENT);
	expect(pageText).not.toMatch(/Renata [A-ZÁÉÍÓÚÑ]/);
	expect(pageText).toContain('Renata');
}

type RenataHeroLayout = {
	details: { top: number; bottom: number; width: number };
	venue: { top: number; bottom: number; width: number };
	scroll: { top: number; bottom: number; width: number };
	scrollTextDisplay: string;
	titleFontSize: number;
	dateFontSize: number;
	venueFontSize: number;
	titleFontFamily: string;
	dateFontFamily: string;
	venueFontFamily: string;
	scrollFontFamily: string;
	titleColor: string;
	dateColor: string;
	timeColor: string;
	venueColor: string;
	scrollColor: string;
	venueOverflow: number;
};

function assertRenataHeroLayout(layout: RenataHeroLayout | null) {
	expect(layout).toBeTruthy();
	if (!layout) return;

	expect(layout.scrollTextDisplay).not.toBe('none');
	expect(layout.scroll.top - layout.details.bottom).toBeGreaterThanOrEqual(16);
	expect(layout.scroll.top - layout.venue.bottom).toBeGreaterThanOrEqual(16);
	expect(layout.titleFontSize).toBeGreaterThan(layout.dateFontSize);
	expect(layout.dateFontSize).toBeGreaterThan(layout.venueFontSize);
	expect(layout.titleFontFamily).toMatch(/Playfair Display/i);
	expect(layout.dateFontFamily).toMatch(/EB Garamond/i);
	expect(layout.venueFontFamily).toMatch(/Montserrat/i);
	expect(layout.scrollFontFamily).toMatch(/Montserrat/i);
	expect(layout.venueOverflow).toBeLessThanOrEqual(1);
	expect(
		new Set([
			layout.titleColor,
			layout.dateColor,
			layout.timeColor,
			layout.venueColor,
			layout.scrollColor,
		]).size,
	).toBeGreaterThanOrEqual(4);
}

test.describe('Renata XV local visual and content audit', () => {
	test.beforeAll(() => {
		fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
	});

	for (const viewport of VIEWPORTS) {
		test(`audits Renata at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
			page,
		}) => {
			const consoleErrors: string[] = [];
			page.on('pageerror', (err) => consoleErrors.push(err.message));
			page.on('console', (msg) => {
				if (msg.type() === 'error') consoleErrors.push(msg.text());
			});

			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.emulateMedia({ reducedMotion: 'reduce' });

			const response = await page.goto('/xv/renata?skipEnvelope=true', {
				waitUntil: 'networkidle',
			});
			expect(response?.status()).toBe(200);

			const pageText = await page.locator('body').innerText();
			await assertRenataLeakScan(page);
			expect(pageText).toMatch(/5 de septiembre de 2026/i);
			expect(pageText).toContain('Ramón Arturo Sainz Quevedo');
			expect(pageText).toContain('Dulce Patricia Echevarria Espinoza');
			expect(pageText).toContain('Saul Chaidez García');
			expect(pageText).toContain('Yuliana Argelia González Beltrán');
			expect(pageText).toMatch(/no vestir de color rosa/i);
			expect(pageText).toMatch(/lluvia de sobres/i);
			expect(pageText).toContain('Parroquia Santa Inés');
			expect(pageText).toContain('InHouse Select · Hacienda Tres Ríos');

			const hero = page.locator('.invitation-hero');
			await expect(hero).toBeVisible();
			await expect(page.locator('.invitation-hero__title')).toHaveText('Renata');
			await expect(hero).toContainText(/7:00\s*p\.\s*m\./i);
			await expect(hero).toContainText(/Hacienda Tres Ríos/i);
			await expect(hero).toHaveAttribute('data-structural-variant', 'standard');
			const family = page.locator('.family').first();
			await expect(family).toHaveAttribute('data-structural-variant', 'asymmetric-groups');
			await expect(family).toHaveAttribute('data-presentation', 'text-only');
			await expect(family.locator('.family__title')).toHaveText(
				'Quienes me acompañan en este día',
			);
			await expect(family.getByText('Ramón Arturo Sainz Quevedo')).toBeVisible();
			await expect(family.getByText('Yuliana Argelia González Beltrán')).toBeVisible();
			expect(await page.locator('[data-screenshot-section="quote"]').count()).toBe(0);
			expect(await page.locator('audio, [data-screenshot-section="music"]').count()).toBe(0);

			const heroImage = page.locator('.invitation-hero__background img').first();
			await expect(heroImage).toBeVisible();
			const heroSrc = await heroImage.getAttribute('src');
			expect(heroSrc).toBeTruthy();
			expect(heroSrc).not.toMatch(/WA0194/i);

			const heroFilter = await heroImage.evaluate((img) => getComputedStyle(img).filter);
			expect(heroFilter === 'none' || heroFilter === '').toBe(true);

			const heroLayout = await hero.evaluate((node) => {
				const details = node.querySelector('.invitation-hero__details');
				const venue = node.querySelector('.invitation-hero__venue');
				const scroll = node.querySelector('.invitation-hero__scroll-indicator');
				const scrollText = node.querySelector('.invitation-hero__scroll-text');
				const title = node.querySelector('.invitation-hero__title');
				const date = node.querySelector('.invitation-hero__date');
				const time = node.querySelector('.invitation-hero__time');
				if (
					!(details instanceof HTMLElement) ||
					!(venue instanceof HTMLElement) ||
					!(scroll instanceof HTMLElement) ||
					!(scrollText instanceof HTMLElement) ||
					!(title instanceof HTMLElement) ||
					!(date instanceof HTMLElement) ||
					!(time instanceof HTMLElement)
				) {
					return null;
				}

				const box = (element: HTMLElement) => {
					const rect = element.getBoundingClientRect();
					return { top: rect.top, bottom: rect.bottom, width: rect.width };
				};

				return {
					details: box(details),
					venue: box(venue),
					scroll: box(scroll),
					scrollTextDisplay: getComputedStyle(scrollText).display,
					titleFontSize: parseFloat(getComputedStyle(title).fontSize),
					dateFontSize: parseFloat(getComputedStyle(date).fontSize),
					venueFontSize: parseFloat(getComputedStyle(venue).fontSize),
					titleFontFamily: getComputedStyle(title).fontFamily,
					dateFontFamily: getComputedStyle(date).fontFamily,
					venueFontFamily: getComputedStyle(venue).fontFamily,
					scrollFontFamily: getComputedStyle(scrollText).fontFamily,
					titleColor: getComputedStyle(title).color,
					dateColor: getComputedStyle(date).color,
					timeColor: getComputedStyle(time).color,
					venueColor: getComputedStyle(venue).color,
					scrollColor: getComputedStyle(scroll).color,
					venueOverflow: venue.scrollWidth - venue.clientWidth,
				};
			});
			assertRenataHeroLayout(heroLayout);

			const heroBoundary = page
				.locator(".invitation-section-wrapper[data-intersection-source='hero']")
				.first();
			await expect(heroBoundary).toHaveAttribute('data-intersection', 'atmospheric-blend');
			const boundaryStyle = await heroBoundary.locator(':scope > *').evaluate((node) => {
				const style = getComputedStyle(node);
				return {
					backgroundImage: style.backgroundImage,
					backgroundSize: style.backgroundSize,
				};
			});
			expect(boundaryStyle.backgroundImage).toContain('linear-gradient');
			expect(boundaryStyle.backgroundSize).toMatch(/100%/);

			const tokens = await page.locator('.event--renata').evaluate((root) => {
				const style = getComputedStyle(root);
				const read = (name: string) => style.getPropertyValue(name).trim();
				const resolve = (value: string) => {
					const probe = document.createElement('span');
					probe.style.color = value;
					root.appendChild(probe);
					const resolved = getComputedStyle(probe).color;
					probe.remove();
					return resolved;
				};
				return {
					gold: read('--color-gold-500'),
					metallic: read('--gold-metallic'),
					heroFilter: read('--hero-image-filter'),
					actionAccent: resolve(read('--color-action-accent')),
					textEmphasis: resolve(read('--color-text-emphasis')),
					cream: resolve(read('--renata-cream')),
					blush: resolve(read('--renata-blush')),
					olive: resolve(read('--renata-olive')),
					coral: resolve(read('--renata-coral')),
					silver: resolve(read('--renata-silver')),
				};
			});
			expect(tokens.gold).not.toMatch(/#d4af37|#c9a227|linear-gradient/i);
			expect(tokens.metallic).not.toMatch(/linear-gradient|#d4af37|#c9a227/i);
			expect(tokens.heroFilter).toBe('none');
			expect(tokens.actionAccent).not.toBe(tokens.textEmphasis);
			expect(tokens.actionAccent).toBe(tokens.olive);
			expect(tokens.textEmphasis).not.toMatch(/232 190 48|#e8be30/i);
			expect(tokens.cream).toBeTruthy();
			expect(tokens.blush).toBeTruthy();
			expect(tokens.coral).toBeTruthy();
			expect(tokens.silver).toBeTruthy();
			expect(
				new Set([tokens.cream, tokens.blush, tokens.olive, tokens.coral, tokens.silver])
					.size,
			).toBe(5);

			const location = page.locator('.event-location').first();
			await location.scrollIntoViewIfNeeded();
			await expect(location).toHaveAttribute(
				'data-structural-variant',
				'stacked-venue-plates',
			);
			await expect(location).toHaveAttribute('data-presentation', 'simple');
			expect(await location.locator('.event-location__nav-button').count()).toBe(0);
			expect(await page.getByRole('link', { name: 'Apple Maps' }).count()).toBe(0);
			expect(await page.getByRole('link', { name: 'Google Maps' }).count()).toBe(0);
			expect(await page.getByRole('link', { name: 'Waze' }).count()).toBe(0);

			const venueNames = await location
				.locator('.event-location__card-content-place')
				.allTextContents();
			expect(venueNames.map((name) => name.trim())).toEqual([
				'Parroquia Santa Inés',
				'InHouse Select · Hacienda Tres Ríos',
			]);
			expect(await location.getByText('Ver mapa').count()).toBe(2);
			expect(await location.locator('.section-nav-button').count()).toBe(0);
			expect(await location.getByText('ITINERARIO').count()).toBe(0);

			const ceremonyMap = page.locator('a[href="https://maps.app.goo.gl/AS7ufXbUyZdyJJU4A"]');
			const receptionMap = page.locator(
				'a[href="https://maps.app.goo.gl/yzDo1Azex7AfmyGX8"]',
			);
			await ceremonyMap.first().scrollIntoViewIfNeeded();
			await expect(ceremonyMap.first()).toBeVisible();
			await receptionMap.first().scrollIntoViewIfNeeded();
			await expect(receptionMap.first()).toBeVisible();

			const itinerary = page.locator('.itinerary').first();
			await expect(itinerary).toHaveAttribute('data-structural-variant', 'editorial-program');
			expect(await page.locator('.itinerary__program-monogram').count()).toBe(0);
			expect(await page.locator('.itinerary__program-paper-surface').count()).toBe(0);

			const itineraryItems = page.locator(
				'.itinerary__item, .itinerary__program-row, [data-itinerary-item]',
			);
			expect(await itineraryItems.count()).toBe(5);
			await expect(itinerary.locator('.itinerary__item-icon-wrapper').first()).toBeHidden();
			await expect(itinerary.getByText('Misa', { exact: true })).toBeVisible();
			await expect(itinerary.getByText('Recepción', { exact: true })).toBeVisible();
			await expect(itinerary.getByText('Vals', { exact: true })).toBeVisible();
			await expect(itinerary.getByText('Cena', { exact: true })).toBeVisible();
			await expect(itinerary.getByText('Cierre', { exact: true })).toBeVisible();
			expect(await itinerary.getByText('Por confirmar').count()).toBe(0);
			expect(await itinerary.locator('[data-time-status="pending"]').count()).toBe(0);
			await expect(itinerary.getByText('7:30 PM', { exact: true })).toBeVisible();
			await expect(itinerary.getByText('9:00 PM', { exact: true })).toBeVisible();
			await expect(itinerary.getByText('12:00 AM', { exact: true })).toBeVisible();

			expect(await page.locator('.invitation-interlude').count()).toBe(3);
			const sequenceKinds = await page
				.locator('#invitation-sections-container > .invitation-section-wrapper')
				.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-section-kind')));
			const giftsIndex = sequenceKinds.indexOf('gifts');
			expect(giftsIndex).toBeGreaterThan(-1);
			expect(sequenceKinds[giftsIndex + 1]).toBe('interlude');
			expect(sequenceKinds[giftsIndex + 2]).toBe('rsvp');

			const gallery = page.locator('.gallery-section').first();
			await expect(gallery).toBeVisible();
			await expect(gallery).toHaveAttribute('data-structural-variant', 'feature-stack');
			await expect(gallery.locator('.gallery-section__title')).toHaveText('Renata');
			await gallery.scrollIntoViewIfNeeded();
			const galleryItems = gallery.locator('.gallery-grid__item');
			expect(await galleryItems.count()).toBe(3);
			expect(
				await galleryItems.evaluateAll((nodes) =>
					nodes.map((node) => node.getAttribute('data-image-key')),
				),
			).toEqual(['gallery-01', 'gallery-feature', 'gallery-03']);
			expect(
				await galleryItems.evaluateAll((nodes) =>
					nodes.map((node) => node.getAttribute('data-layout-role')),
				),
			).toEqual(['feature', 'standard', 'wide']);
			const feature = gallery
				.locator('.gallery-grid__item[data-layout-role="feature"]')
				.first();
			await expect(feature).toBeVisible();
			const featureRatio = await feature.evaluate(
				(node) => getComputedStyle(node).aspectRatio,
			);
			expect(featureRatio.replace(/\s+/g, '')).toMatch(/^3\/4$|^0\.75$/);

			if (viewport.width >= 1440) {
				const boxes = await galleryItems.evaluateAll((nodes) =>
					nodes.map((node) => {
						const box = node.getBoundingClientRect();
						return {
							top: box.top,
							left: box.left,
							height: box.height,
							key: node.getAttribute('data-image-key'),
						};
					}),
				);
				expect(boxes[0].key).toBe('gallery-01');
				expect(boxes[1].key).toBe('gallery-feature');
				expect(boxes[2].key).toBe('gallery-03');
				expect(boxes[0].left).toBeLessThan(boxes[1].left);
				expect(boxes[1].left).toBeGreaterThan(boxes[0].left + 8);
				expect(Math.abs(boxes[1].left - boxes[2].left)).toBeLessThan(40);
				expect(boxes[2].top).toBeGreaterThan(boxes[1].top + 8);
				expect(boxes[0].height).toBeGreaterThan(boxes[1].height);
			}

			expect(await page.locator('.personalized-access').count()).toBe(0);

			const rsvp = page.locator('.rsvp').first();
			await expect(rsvp).toHaveAttribute('data-structural-variant', 'formal-register');
			await expect(rsvp).toHaveAttribute('data-state', 'locked');

			expect(await page.locator('.event-location__card-flourish').count()).toBe(2);
			expect(
				await page
					.locator('.rsvp input, .rsvp textarea, .rsvp button[type="submit"]')
					.count(),
			).toBe(0);

			const countdown = page.locator('.countdown-section').first();
			await expect(countdown).toHaveAttribute('data-variant', 'editorial');
			await expect(countdown.locator('.countdown-title')).toHaveText('El día se acerca');
			await expect(countdown.locator('.countdown-invitation-text')).toHaveText(
				'Misa a las 5:00 p. m. · Recepción a las 7:00 p. m.',
			);
			expect(await countdown.locator('.countdown__segment').count()).toBe(4);
			const countdownMetrics = await countdown.evaluate((node) => {
				const title = node.querySelector('.countdown-title');
				const titleStyle = title ? getComputedStyle(title) : null;
				const segments = [...node.querySelectorAll('.countdown__segment')];
				const firstRowTop = segments[0]?.getBoundingClientRect().top ?? 0;
				return {
					titleFill: titleStyle?.webkitTextFillColor ?? '',
					titleColor: titleStyle?.color ?? '',
					titleBackground: titleStyle?.backgroundImage ?? '',
					titleMarginBottom: titleStyle?.marginBottom ?? '',
					firstRowCount: segments.filter(
						(segment) =>
							Math.abs(segment.getBoundingClientRect().top - firstRowTop) < 2,
					).length,
					sectionBackground: getComputedStyle(node).backgroundImage,
				};
			});
			expect(
				`${countdownMetrics.titleFill} ${countdownMetrics.titleColor} ${countdownMetrics.titleBackground}`,
			).toMatch(/196,\s*126,\s*118/i);
			expect(
				`${countdownMetrics.titleFill} ${countdownMetrics.titleColor} ${countdownMetrics.titleBackground}`,
			).not.toMatch(/199,\s*173,\s*118|232,\s*190,\s*48/i);
			expect(countdownMetrics.sectionBackground).toMatch(/linear-gradient/i);
			expect(countdownMetrics.sectionBackground).not.toMatch(
				/244,\s*228,\s*224|199,\s*173,\s*118/i,
			);
			expect(Number.parseFloat(countdownMetrics.titleMarginBottom)).toBeGreaterThanOrEqual(
				viewport.width >= 1440 ? 32 : 24,
			);
			expect(countdownMetrics.firstRowCount).toBe(viewport.width >= 1440 ? 4 : 2);

			const familyBg = await page
				.locator('.family')
				.first()
				.evaluate((node) => getComputedStyle(node).backgroundColor);
			expect(familyBg).not.toMatch(/rgb\(\s*(18|22)\s*,\s*(16|20)\s*,\s*(14|18)\s*\)/i);

			const rsvpChapter = page
				.locator('.invitation-section-wrapper[data-section-kind="rsvp"]')
				.first();
			const rsvpChapterBg = await rsvpChapter.evaluate(
				(node) => getComputedStyle(node).backgroundColor,
			);
			expect(rsvpChapterBg).toMatch(/rgb\(\s*70\s*,\s*86\s*,\s*56\s*\)/i);
			expect(rsvpChapterBg).not.toMatch(/rgb\(\s*120\s*,\s*56\s*,\s*38\s*\)/i);

			const galleryImages = gallery.locator('img');
			expect(await galleryImages.count()).toBe(3);
			for (const img of await galleryImages.all()) {
				await img.scrollIntoViewIfNeeded();
				await expect
					.poll(async () =>
						img.evaluate((node) => (node as HTMLImageElement).naturalWidth),
					)
					.toBeGreaterThan(0);
			}

			const thankYouImage = page.locator('.thank-you-section img').first();
			await thankYouImage.scrollIntoViewIfNeeded();
			await expect(thankYouImage).toBeVisible();
			const thankYouSrc = await thankYouImage.getAttribute('src');
			expect(thankYouSrc).toBeTruthy();
			expect(thankYouSrc).not.toBe(heroSrc);
			await expect
				.poll(async () =>
					thankYouImage.evaluate((node) => (node as HTMLImageElement).naturalWidth),
				)
				.toBeGreaterThan(0);

			const overflow = await page.evaluate(() => {
				const doc = document.documentElement;
				return {
					horizontal: doc.scrollWidth - doc.clientWidth,
					hasGoldLettering: [...document.querySelectorAll('*')].some((node) => {
						const style = getComputedStyle(node);
						const image = `${style.backgroundImage} ${style.color}`;
						return /linear-gradient\([^)]*(?:gold|#d4af37|#c9a227|#e8c872)/i.test(
							image,
						);
					}),
				};
			});
			expect(overflow.horizontal).toBeLessThanOrEqual(1);
			expect(overflow.hasGoldLettering).toBe(false);

			const yellowUi = await page.evaluate(() => {
				const yellow = /rgb\(\s*232\s*,\s*190\s*,\s*48\s*\)|#e8be30/i;
				return [...document.querySelectorAll('*')].some((node) => {
					const style = getComputedStyle(node);
					return yellow.test(
						`${style.color} ${style.borderColor} ${style.backgroundColor}`,
					);
				});
			});
			expect(yellowUi).toBe(false);

			const sections = [
				{ name: 'hero', locator: '.invitation-hero' },
				{ name: 'family', locator: '.family, .family-section' },
				{ name: 'countdown', locator: '.countdown-section' },
				{ name: 'location', locator: '.event-location' },
				{ name: 'itinerary', locator: '.itinerary' },
				{ name: 'gallery', locator: '.gallery-section' },
				{ name: 'gifts', locator: '.gifts-section' },
				{ name: 'rsvp', locator: '.rsvp' },
				{ name: 'thankyou', locator: '.thank-you-section' },
			] as const;
			for (const section of sections) {
				const target = page.locator(section.locator).first();
				if ((await target.count()) === 0) continue;
				await target.scrollIntoViewIfNeeded();
				const sectionImage = target.locator('img').first();
				if ((await sectionImage.count()) > 0) {
					await sectionImage.evaluate(async (node) => {
						if (node instanceof HTMLImageElement) {
							await node.decode().catch(() => undefined);
						}
					});
				}
				await target.screenshot({
					path: path.join(ARTIFACT_ROOT, `${viewport.name}-${section.name}.png`),
				});
			}

			expect(consoleErrors.filter((message) => !/favicon|sourcemap/i.test(message))).toEqual(
				[],
			);
		});
	}

	for (const viewport of VIEWPORTS) {
		test(`sealed envelope uses a single seal control at ${viewport.name}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.addInitScript(() => {
				window.localStorage.removeItem('envelope-opened-renata');
			});

			const response = await page.goto('/xv/renata?forceEnvelope=true', {
				waitUntil: 'networkidle',
			});
			expect(response?.status()).toBe(200);

			const openControls = page.locator('[data-envelope-open]');
			await expect(openControls).toHaveCount(2);
			await expect(page.locator('.envelope-seal-button')).toHaveCount(1);
			await expect(page.locator('.envelope-wrapper')).toHaveAttribute(
				'data-variant',
				'premiere-floral',
			);
			await expect(page.locator('.envelope-external-instruction')).toHaveText(
				'Abra su invitación',
			);
			await expect(page.locator('.envelope-name')).toHaveText('Renata - Mis XV años');
			await expect(page.locator('.envelope-manifest-label')).toHaveCount(0);
			await expect(page.locator('.envelope-details')).toContainText(/2026/);
			await expect(page.locator('[data-envelope-open]').first()).toHaveAttribute(
				'data-seal-icon',
				'monogram',
			);
			await expect(page.locator('.invitation-reveal-card__label')).toHaveText('MIS XV');
			await expect(page.locator('.invitation-reveal-card__name')).toHaveText('Renata');
			await assertRenataLeakScan(page);

			const sealBox = await openControls.first().boundingBox();
			expect(sealBox).toBeTruthy();
			expect(Math.min(sealBox?.width ?? 0, sealBox?.height ?? 0)).toBeGreaterThanOrEqual(48);

			await page.screenshot({
				path: path.join(ARTIFACT_ROOT, `${viewport.name}-reveal-closed.png`),
			});

			await openControls.first().click();
			await expect(page.locator('.invitation-hero__title')).toHaveText('Renata', {
				timeout: 8_000,
			});
			await expect(page.locator('.invitation-hero')).toContainText(/7:00\s*p\.\s*m\./i);
			await expect(page.locator('.invitation-hero')).toContainText(/Hacienda Tres Ríos/i);
		});
	}

	for (const viewport of VIEWPORTS) {
		test(`letter emergence contrast at ${viewport.name}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.addInitScript(() => {
				window.localStorage.removeItem('envelope-opened-renata');
			});

			const response = await page.goto('/xv/renata?forceEnvelope=true&reveal=letter', {
				waitUntil: 'networkidle',
			});
			expect(response?.status()).toBe(200);

			const card = page.locator('.invitation-reveal-card');
			await expect(card).toBeVisible();
			await expect(page.locator('.invitation-reveal-card__label')).toHaveText('MIS XV');
			await expect(page.locator('.invitation-reveal-card__name')).toHaveText('Renata');
			await expect(page.locator('.invitation-reveal-card__date')).toContainText(/2026/);
			await expect(page.locator('.invitation-reveal-card__tagline')).toHaveText(
				'05 · 09 · 2026',
			);

			const contrast = await card.evaluate((node) => {
				const name = node.querySelector('.invitation-reveal-card__name');
				const label = node.querySelector('.invitation-reveal-card__label');
				if (!(name instanceof HTMLElement) || !(label instanceof HTMLElement)) {
					return null;
				}

				return {
					nameColor: getComputedStyle(name).color,
					labelColor: getComputedStyle(label).color,
				};
			});

			expect(contrast).toBeTruthy();
			expect(contrast?.nameColor).toBeTruthy();
			expect(contrast?.labelColor).toBeTruthy();
			expect(contrast?.nameColor).not.toBe(contrast?.labelColor);

			await page.screenshot({
				path: path.join(ARTIFACT_ROOT, `${viewport.name}-reveal-letter.png`),
			});
			await assertRenataLeakScan(page);
		});
	}

	for (const viewport of VIEWPORTS) {
		test(`public RSVP stays locked formal-register at ${viewport.name}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.emulateMedia({ reducedMotion: 'reduce' });

			const response = await page.goto('/xv/renata?skipEnvelope=true', {
				waitUntil: 'networkidle',
			});
			expect(response?.status()).toBe(200);

			expect(await page.locator('.personalized-access').count()).toBe(0);
			const rsvp = page.locator('.rsvp').first();
			await expect(rsvp).toHaveAttribute('data-structural-variant', 'formal-register');
			await expect(rsvp).toHaveAttribute('data-state', 'locked');
			expect(
				await page
					.locator('.rsvp input, .rsvp textarea, .rsvp button[type="submit"]')
					.count(),
			).toBe(0);
			const rsvpChapter = page
				.locator('.invitation-section-wrapper[data-section-kind="rsvp"]')
				.first();
			const rsvpChapterBg = await rsvpChapter.evaluate(
				(node) => getComputedStyle(node).backgroundColor,
			);
			expect(rsvpChapterBg).toMatch(/rgb\(\s*70\s*,\s*86\s*,\s*56\s*\)/i);
			expect(rsvpChapterBg).not.toMatch(/rgb\(\s*120\s*,\s*56\s*,\s*38\s*\)/i);
			await assertRenataLeakScan(page);
			await rsvp.screenshot({
				path: path.join(ARTIFACT_ROOT, `${viewport.name}-rsvp-locked.png`),
			});
		});
	}

	for (const viewport of VIEWPORTS) {
		test(`screenshot preview shows formal-pass at ${viewport.name}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.emulateMedia({ reducedMotion: 'reduce' });

			const response = await page.goto('/xv/renata?skipEnvelope=true&screenshot', {
				waitUntil: 'networkidle',
			});
			expect(response?.status()).toBe(200);

			const personalizedAccess = page.locator('.personalized-access').first();
			await expect(personalizedAccess).toBeVisible();
			await expect(personalizedAccess).toHaveAttribute(
				'data-structural-variant',
				'formal-pass',
			);
			await expect(
				page.locator(
					'.invitation-section-wrapper[data-section-kind="personalized-access"]',
				),
			).toHaveAttribute('data-intersection-source', 'interlude-after-gifts');
			expect(
				await personalizedAccess.locator('.access-card__ornaments').count(),
			).toBeGreaterThan(0);
			await expect(page.locator('.rsvp').first()).toHaveAttribute(
				'data-structural-variant',
				'formal-register',
			);
			await assertRenataLeakScan(page);
			await personalizedAccess.screenshot({
				path: path.join(ARTIFACT_ROOT, `${viewport.name}-personalized-access.png`),
			});
		});
	}

	for (const viewport of VIEWPORTS) {
		test(`countdown keeps shared editorial units at ${viewport.name}`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.emulateMedia({ reducedMotion: 'reduce' });

			const response = await page.goto('/xv/renata?skipEnvelope=true', {
				waitUntil: 'networkidle',
			});
			expect(response?.status()).toBe(200);
			const section = page.locator('.countdown-section').first();
			await section.scrollIntoViewIfNeeded();
			const renata = await section.evaluate(measureCountdownArchitecture);
			await section.screenshot({
				path: path.join(ARTIFACT_ROOT, `${viewport.name}-countdown-renata.png`),
			});

			expect(renata.variant).toBe('editorial');
			expect(renata.segmentCount).toBe(4);
			expect(renata.firstRowCount).toBe(viewport.width >= 1440 ? 4 : 2);
		});
	}
});
