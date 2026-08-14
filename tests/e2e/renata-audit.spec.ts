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

async function assertRenataLeakScan(page: Page) {
	const pageText = await page.locator('body').innerText();
	expect(pageText).not.toMatch(FOREIGN_CONTENT);
	expect(pageText).not.toMatch(/Renata [A-ZÁÉÍÓÚÑ]/);
	expect(pageText).toContain('Renata');
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
			expect(pageText).toContain('InHouse Select Hacienda Tres Ríos');

			const hero = page.locator('.invitation-hero');
			await expect(hero).toBeVisible();
			await expect(page.locator('.invitation-hero__title')).toHaveText('Renata');
			await expect(hero).toContainText(/7:00\s*p\.\s*m\./i);
			await expect(hero).toContainText(/Hacienda Tres Ríos/i);
			await expect(hero).toHaveAttribute('data-structural-variant', 'standard');
			expect(await page.locator('[data-screenshot-section="quote"]').count()).toBe(0);
			expect(await page.locator('audio, [data-screenshot-section="music"]').count()).toBe(0);

			const heroImage = page.locator('.invitation-hero__background img').first();
			await expect(heroImage).toBeVisible();
			const heroSrc = await heroImage.getAttribute('src');
			expect(heroSrc).toBeTruthy();
			expect(heroSrc).not.toMatch(/WA0194/i);

			const heroFilter = await heroImage.evaluate((img) => getComputedStyle(img).filter);
			expect(heroFilter === 'none' || heroFilter === '').toBe(true);

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
				'InHouse Select Hacienda Tres Ríos',
			]);
			expect(await location.getByText('Ver mapa').count()).toBe(2);

			const ceremonyMap = page.locator('a[href="https://maps.app.goo.gl/jkS3UvSKdTzcZxu9A"]');
			const receptionMap = page.locator(
				'a[href="https://maps.app.goo.gl/oEA3Y3DhgMEGn6Lc7"]',
			);
			await expect(ceremonyMap.first()).toBeVisible();
			await expect(receptionMap.first()).toBeVisible();

			const itinerary = page.locator('.itinerary').first();
			await expect(itinerary).toHaveAttribute('data-structural-variant', 'editorial-ledger');
			expect(await page.locator('.itinerary__program-monogram').count()).toBe(0);
			expect(await page.locator('.itinerary__program-paper-surface').count()).toBe(0);

			const itineraryItems = page.locator(
				'.itinerary__item, .itinerary__program-row, [data-itinerary-item]',
			);
			expect(await itineraryItems.count()).toBe(2);

			const gallery = page.locator('.gallery-section').first();
			await expect(gallery).toBeVisible();
			await expect(gallery).toHaveAttribute('data-structural-variant', 'paired-feature-band');
			await gallery.scrollIntoViewIfNeeded();
			const galleryItems = gallery.locator('.gallery-grid__item');
			expect(await galleryItems.count()).toBe(5);
			expect(
				await galleryItems.evaluateAll((nodes) =>
					nodes.map((node) => node.getAttribute('data-image-key')),
				),
			).toEqual(['gallery-01', 'gallery-02', 'gallery-feature', 'gallery-03', 'gallery-04']);
			const feature = gallery
				.locator('.gallery-grid__item[data-layout-role="feature"]')
				.first();
			await expect(feature).toBeVisible();
			const featureRatio = await feature.evaluate(
				(node) => getComputedStyle(node).aspectRatio,
			);
			expect(featureRatio.replace(/\s+/g, '')).toMatch(/^8\/5$|^1\.6$/);

			if (viewport.width >= 1440) {
				const boxes = await galleryItems.evaluateAll((nodes) =>
					nodes.map((node) => {
						const box = node.getBoundingClientRect();
						return {
							top: box.top,
							width: box.width,
							key: node.getAttribute('data-image-key'),
						};
					}),
				);
				expect(Math.abs(boxes[0].top - boxes[1].top)).toBeLessThan(2);
				expect(boxes[2].key).toBe('gallery-feature');
				expect(boxes[2].width).toBeGreaterThan(boxes[0].width * 1.5);
				expect(boxes[2].top).toBeGreaterThan(boxes[0].top + 8);
				expect(Math.abs(boxes[3].top - boxes[4].top)).toBeLessThan(2);
				expect(boxes[3].top).toBeGreaterThan(boxes[2].top + 8);
			}

			const personalizedAccess = page.locator('.personalized-access').first();
			if ((await personalizedAccess.count()) > 0) {
				await expect(personalizedAccess).toHaveAttribute(
					'data-structural-variant',
					'standard',
				);
				expect(await personalizedAccess.locator('.access-card__ornaments').count()).toBe(0);
			}

			expect(await page.locator('.event-location__card-flourish').count()).toBe(2);
			expect(
				await page
					.locator('.rsvp input, .rsvp textarea, .rsvp button[type="submit"]')
					.count(),
			).toBe(0);

			const countdownTitle = page.locator('.countdown-title').first();
			if ((await countdownTitle.count()) > 0) {
				const titleFill = await countdownTitle.evaluate(
					(node) => getComputedStyle(node).webkitTextFillColor,
				);
				expect(titleFill).not.toBe('transparent');
				expect(titleFill).not.toMatch(/232,\s*190,\s*48/i);
			}

			const familyBg = await page
				.locator('.family')
				.first()
				.evaluate((node) => getComputedStyle(node).backgroundColor);
			expect(familyBg).not.toMatch(/rgb\(\s*(18|22)\s*,\s*(16|20)\s*,\s*(14|18)\s*\)/i);

			const rsvpBg = await page
				.locator('.rsvp')
				.first()
				.evaluate((node) => getComputedStyle(node).backgroundColor);
			expect(rsvpBg).not.toMatch(/rgb\(\s*14\s*,\s*12\s*,\s*10\s*\)/i);
			expect(rsvpBg).not.toMatch(/rgb\(\s*(18|22)\s*,\s*(16|20)\s*,\s*(14|18)\s*\)/i);

			const galleryImages = gallery.locator('img');
			expect(await galleryImages.count()).toBeGreaterThanOrEqual(5);
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
		test(`sealed envelope uses seal and CTA at ${viewport.name}`, async ({ page }) => {
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
			await expect(page.locator('.envelope-wrapper')).toHaveAttribute(
				'data-variant',
				'premiere-floral',
			);
			await expect(page.locator('.envelope-external-instruction')).toContainText(
				'Abra su invitación',
			);
			await expect(page.locator('.envelope-name')).toHaveText('XV años de Renata');
			await expect(page.locator('.envelope-details')).toContainText(/2026/);
			await expect(page.locator('.envelope-details')).toContainText(/Hacienda/i);
			await expect(page.locator('[data-envelope-open]').first()).toHaveAttribute(
				'data-seal-icon',
				'monogram',
			);
			await expect(page.locator('.invitation-reveal-card__label')).toHaveText(
				'CELEBRO MIS XV',
			);
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
			await expect(page.locator('.invitation-reveal-card__label')).toHaveText(
				'CELEBRO MIS XV',
			);
			await expect(page.locator('.invitation-reveal-card__name')).toHaveText('Renata');
			await expect(page.locator('.invitation-reveal-card__date')).toContainText(/2026/);

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
});
