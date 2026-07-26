import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const VIEWPORTS = [
	{ name: 'mobile-narrow', width: 360, height: 800 },
	{ name: 'mobile-standard', width: 390, height: 844 },
	{ name: 'tablet-portrait', width: 768, height: 1024 },
	{ name: 'tablet-landscape', width: 1024, height: 768 },
	{ name: 'desktop', width: 1440, height: 900 },
] as const;

const ARTIFACT_ROOT = path.resolve(process.cwd(), 'temp', 'abril-audit-screenshots');

test.describe('Abril Michelle Becerra Rea XV E2E Visual & Functional Audit', () => {
	test.beforeAll(() => {
		fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
	});

	for (const viewport of VIEWPORTS) {
		test(`audits Abril invitation at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
			page,
		}) => {
			const consoleErrors: string[] = [];
			const networkErrors: string[] = [];

			page.on('pageerror', (err) => consoleErrors.push(err.message));
			page.on('console', (msg) => {
				if (msg.type() === 'error') consoleErrors.push(msg.text());
			});
			page.on('requestfailed', (req) => {
				networkErrors.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
			});

			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			// Freeze reveal motion so geometry and screenshots are deterministic.
			await page.emulateMedia({ reducedMotion: 'reduce' });

			const response = await page.goto('/xv/abril-michelle-becerra-rea?skipEnvelope=true', {
				waitUntil: 'networkidle',
			});

			expect(response?.status()).toBe(200);

			// 1. Hero verification
			const hero = page.locator('#inicio, .hero');
			await expect(hero).toBeVisible();
			const heroTitle = page.locator('.hero__title, h1');
			await expect(heroTitle).toBeVisible();
			await expect(heroTitle).toContainText(/Abril\s*Michelle/);

			// Check hero background image presence
			const heroBg = page.locator(
				'.invitation-hero__background img, .hero__bg-img, .hero__bg-container img, img.hero__bg',
			);
			const heroBgCount = await heroBg.count();
			expect(heroBgCount).toBeGreaterThanOrEqual(1);

			// Hero composition contract: preserve approved crop and keep copy as one stack.
			const expectedFocal =
				viewport.width < 768 ? '50% 38%' : viewport.width < 992 ? '50% 40%' : '50% 42%';
			const heroComposition = await page.locator('.invitation-hero').evaluate((element) => {
				const content = element.querySelector<HTMLElement>('.invitation-hero__content')!;
				const title = element.querySelector<HTMLElement>('.invitation-hero__title')!;
				const details = element.querySelector<HTMLElement>('.invitation-hero__details')!;
				const image = element.querySelector<HTMLElement>(
					'.invitation-hero__background img',
				)!;
				const contentRect = content.getBoundingClientRect();
				const titleRect = title.getBoundingClientRect();
				const detailsRect = details.getBoundingClientRect();
				const detailsStyle = getComputedStyle(details);
				const titleStyle = getComputedStyle(title);
				const titleMatrix = new DOMMatrixReadOnly(titleStyle.transform);

				return {
					contentRect: { top: contentRect.top, bottom: contentRect.bottom },
					titleRect: { top: titleRect.top, bottom: titleRect.bottom },
					detailsRect: { top: detailsRect.top, bottom: detailsRect.bottom },
					detailsPosition: detailsStyle.position,
					detailsBackground: detailsStyle.backgroundImage,
					detailsBackdrop: detailsStyle.backdropFilter,
					titleTranslateX: titleMatrix.m41,
					titleTranslateY: titleMatrix.m42,
					titleTextTransform: titleStyle.textTransform,
					objectPosition: getComputedStyle(image).objectPosition,
				};
			});

			expect(heroComposition.objectPosition).toBe(expectedFocal);
			expect(heroComposition.detailsPosition).toBe('static');
			expect(heroComposition.detailsBackground).toBe('none');
			expect(heroComposition.detailsBackdrop).toBe('none');
			expect(Math.abs(heroComposition.titleTranslateX)).toBeLessThan(4);
			expect(Math.abs(heroComposition.titleTranslateY)).toBeLessThan(4);
			expect(heroComposition.titleTextTransform).toBe('none');
			expect(heroComposition.titleRect.top).toBeGreaterThanOrEqual(
				heroComposition.contentRect.top,
			);
			expect(heroComposition.detailsRect.bottom).toBeLessThanOrEqual(
				heroComposition.contentRect.bottom + 1,
			);
			expect(heroComposition.detailsRect.top - heroComposition.titleRect.bottom).toBeLessThan(
				viewport.height * 0.15,
			);

			// 2. Locations verification
			const locationSection = page.locator(
				'section.event-location, .location-section, .location',
			);
			await expect(locationSection).toBeVisible();

			// Both cards: Ceremony & Reception
			const ceremonyName = page.locator(
				'text=Templo y Ex Convento de Nuestra Señora de la Merced',
			);
			await expect(ceremonyName).toBeVisible();

			const receptionName = locationSection.getByText('Garden Palace', { exact: true });
			await expect(receptionName).toBeVisible();

			// Verify addresses
			const ceremonyAddr = page.locator('text=Agustín Rivera 433-C');
			await expect(ceremonyAddr).toBeVisible();

			const receptionAddr = page.locator('text=Macedio Ayala núm. 70');
			await expect(receptionAddr).toBeVisible();

			// Directions links preserve exact Google Maps URLs
			const ceremonyDirections = page.locator('a[href*="PKbLyRbrjiLfcc4C6"]');
			await expect(ceremonyDirections).toBeVisible();

			const receptionDirections = page.locator('a[href*="EbgZsEcrjTSmD9wK6"]');
			await expect(receptionDirections).toBeVisible();

			// 3. Family verification
			const familyMother = page.locator('text=Sandy Guadalupe Rea Mendoza');
			await expect(familyMother).toBeVisible();

			const familyFather = page.locator('text=José Luis Becerra Ornelas');
			await expect(familyFather).toBeVisible();

			const godparent1 = page.locator('text=María del Carmen Becerra Ornelas');
			await expect(godparent1).toBeVisible();

			const godparent2 = page.locator('text=Ramiro Contreras Bermejo');
			await expect(godparent2).toBeVisible();

			// 4. Itinerary / Schedule verification
			const itinerarySection = page.locator('section.itinerary, .itinerary');
			await expect(itinerarySection).toBeVisible();

			const itineraryMisa = itinerarySection.getByRole('heading', {
				name: 'Misa',
				exact: true,
			});
			await expect(itineraryMisa).toBeVisible();

			const itineraryRecepcion = itinerarySection.getByRole('heading', {
				name: 'Recepción',
				exact: true,
			});
			await expect(itineraryRecepcion).toBeVisible();

			// 5. Gallery & alt text verification
			const galleryItems = page.locator(
				'.gallery__item, .gallery img, img[alt*="Abril Michelle"]',
			);
			const galleryCount = await galleryItems.count();
			expect(galleryCount).toBeGreaterThanOrEqual(4);

			// Check all gallery images have alt attributes
			for (let i = 0; i < galleryCount; i++) {
				const img = galleryItems.nth(i);
				const alt = await img.getAttribute('alt');
				expect(alt).toBeTruthy();
			}

			// 6. Horizontal overflow check
			const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
			const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
			expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

			// 7. Traverse the page so lazy interlude media is present in full-page evidence.
			await page.evaluate(async () => {
				const sections = document.querySelectorAll<HTMLElement>(
					'[data-screenshot-section]',
				);
				const previousScrollBehavior = document.documentElement.style.scrollBehavior;
				document.documentElement.style.scrollBehavior = 'auto';

				for (const section of sections) {
					const sectionTop =
						section.getBoundingClientRect().top +
						window.scrollY -
						window.innerHeight / 3;
					window.scrollTo(0, sectionTop);
					await new Promise<void>((resolve) => {
						window.setTimeout(resolve, 150);
					});
				}

				window.scrollTo({ top: 0 });
				document.documentElement.style.scrollBehavior = previousScrollBehavior;
			});
			await page.waitForFunction(() =>
				Array.from(
					document.querySelectorAll<HTMLImageElement>('.invitation-interlude__image'),
				).every((image) => image.complete && image.naturalWidth > 0),
			);

			// 8. Console & Network error checks
			expect(consoleErrors).toEqual([]);
			expect(networkErrors).toEqual([]);

			// Capture screenshot for visual inspection
			const screenshotPath = path.join(
				ARTIFACT_ROOT,
				`abril-${viewport.name}-${viewport.width}x${viewport.height}.png`,
			);
			await page.screenshot({ path: screenshotPath, fullPage: true });
		});
	}

	test('audits accessibility: keyboard focus and reduced motion on Abril invitation', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto('/xv/abril-michelle-becerra-rea?skipEnvelope=true', {
			waitUntil: 'networkidle',
		});

		// Tab through interactive elements and check focus indicator
		await page.keyboard.press('Tab');
		const activeTag = await page.evaluate(() => document.activeElement?.tagName);
		expect(activeTag).toBeTruthy();

		// Reduced motion test
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.reload({ waitUntil: 'networkidle' });

		const heroTitle = page.locator('.hero__title, h1');
		await expect(heroTitle).toBeVisible();
	});
});
