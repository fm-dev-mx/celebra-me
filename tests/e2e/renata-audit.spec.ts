import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const VIEWPORTS = [
	{ name: 'mobile-standard', width: 390, height: 844 },
	{ name: 'desktop', width: 1440, height: 900 },
] as const;

const ARTIFACT_ROOT = path.resolve(process.cwd(), 'temp', 'renata-audit-screenshots');

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
			expect(pageText).not.toMatch(/Renata [A-ZÁÉÍÓÚÑ]/);
			expect(pageText).toContain('Renata');
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

			const gallery = page.locator('.gallery-section, [data-variant="paired-feature-band"]');
			await expect(gallery.first()).toBeVisible();
			await gallery.first().scrollIntoViewIfNeeded();
			const feature = gallery
				.locator('.gallery-grid__item[data-layout-role="feature"]')
				.first();
			await expect(feature).toBeVisible();
			const featureRatio = await feature.evaluate(
				(node) => getComputedStyle(node).aspectRatio,
			);
			expect(featureRatio.replace(/\s+/g, '')).toMatch(/^8\/5$|^1\.6$/);

			const personalizedAccess = page.locator('.personalized-access').first();
			if ((await personalizedAccess.count()) > 0) {
				await expect(personalizedAccess).toHaveAttribute(
					'data-structural-variant',
					'standard',
				);
				expect(await personalizedAccess.locator('.access-card__ornaments').count()).toBe(0);
			}

			expect(await page.locator('.event-location__card-flourish').count()).toBe(0);

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
});
