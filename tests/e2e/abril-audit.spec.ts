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

const ARTIFACT_ROOT = path.resolve(
	process.cwd(),
	'temp',
	'abril-audit-screenshots',
);

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

			const response = await page.goto('/xv/abril-michelle-becerra-rea?skipEnvelope=true', {
				waitUntil: 'networkidle',
			});

			expect(response?.status()).toBe(200);

			// 1. Hero verification
			const hero = page.locator('#inicio, .hero');
			await expect(hero).toBeVisible();
			const heroTitle = page.locator('.hero__title, h1');
			await expect(heroTitle).toBeVisible();
			await expect(heroTitle).toContainText('Abril Michelle');

			// Check hero background image presence
			const heroBg = page.locator(
				'.invitation-hero__background img, .hero__bg-img, .hero__bg-container img, img.hero__bg',
			);
			const heroBgCount = await heroBg.count();
			expect(heroBgCount).toBeGreaterThanOrEqual(1);

			// 2. Locations verification
			const locationSection = page.locator('section.event-location, .location-section, .location');
			await expect(locationSection).toBeVisible();

			// Both cards: Ceremony & Reception
			const ceremonyName = page.locator('text=Templo y Ex Convento de Nuestra Señora de la Merced');
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

			const itineraryMisa = itinerarySection.getByRole('heading', { name: 'Misa', exact: true });
			await expect(itineraryMisa).toBeVisible();

			const itineraryRecepcion = itinerarySection.getByRole('heading', { name: 'Recepción', exact: true });
			await expect(itineraryRecepcion).toBeVisible();

			// 5. Gallery & alt text verification
			const galleryItems = page.locator('.gallery__item, .gallery img, img[alt*="Abril Michelle"]');
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

			// 7. Console & Network error checks
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
