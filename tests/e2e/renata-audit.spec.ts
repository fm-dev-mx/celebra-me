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
				return {
					gold: style.getPropertyValue('--color-gold-500').trim(),
					metallic: style.getPropertyValue('--gold-metallic').trim(),
					heroFilter: style.getPropertyValue('--hero-image-filter').trim(),
				};
			});
			expect(tokens.gold).not.toMatch(/#d4af37|#c9a227|linear-gradient/i);
			expect(tokens.metallic).not.toMatch(/linear-gradient|#d4af37|#c9a227/i);
			expect(tokens.heroFilter).toBe('none');

			const ceremonyMap = page.locator('a[href="https://maps.app.goo.gl/jkS3UvSKdTzcZxu9A"]');
			const receptionMap = page.locator(
				'a[href="https://maps.app.goo.gl/oEA3Y3DhgMEGn6Lc7"]',
			);
			await expect(ceremonyMap.first()).toBeVisible();
			await expect(receptionMap.first()).toBeVisible();

			const itineraryItems = page.locator(
				'.itinerary__program-row, .itinerary-item, [data-itinerary-item]',
			);
			const itineraryCount = await itineraryItems.count();
			if (itineraryCount === 0) {
				await expect(page.getByText('Misa', { exact: true }).first()).toBeVisible();
				await expect(page.getByText('Recepción', { exact: true }).first()).toBeVisible();
				await expect(page.getByText('5:00 p. m.').first()).toBeVisible();
				await expect(page.getByText('7:00 p. m.').first()).toBeVisible();
			} else {
				expect(itineraryCount).toBe(2);
			}

			const gallery = page.locator('.gallery-section, [data-variant="paired-feature-band"]');
			await expect(gallery.first()).toBeVisible();
			await gallery.first().scrollIntoViewIfNeeded();
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
