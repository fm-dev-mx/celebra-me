import { expect, test, type Page } from '@playwright/test';

/**
 * Computed-style contracts for post-ownership visual recovery.
 * Golden values are RGB/CSS strings derived from the recovery authority
 * (Production / pre-ownership SCSS), not from post-refactor PNG baselines.
 */

const SEED = [
	{
		name: 'valentina',
		path: '/xv/valentina-hernandez?skipEnvelope=true',
		heroVariant: 'editorial-cover',
		thankYouVariant: 'editorial-back-cover',
	},
	{
		name: 'alba',
		path: '/cumple/alba-rosa-quinonez?skipEnvelope=true',
		heroVariant: 'standard',
		thankYouVariant: 'standard',
	},
	{
		name: 'xareni',
		path: '/xv/xareni-iyarit?skipEnvelope=true',
		heroVariant: 'standard',
		thankYouVariant: 'editorial-back-cover',
	},
	{
		name: 'romina',
		path: '/xv/romina-rios-chaparro?skipEnvelope=true',
		heroVariant: 'split-cover',
		thankYouVariant: 'standard',
	},
	{
		name: 'ana-sofia',
		path: '/xv/ana-sofia-cota-guillen?skipEnvelope=true',
		heroVariant: 'standard',
		thankYouVariant: 'editorial-back-cover',
	},
] as const;

async function computed(
	page: Page,
	selector: string,
): Promise<{
	backgroundColor: string;
	backgroundImage: string;
	color: string;
	padding: string;
	textTransform: string;
	variant: string | null;
}> {
	return page.locator(selector).evaluate((el) => {
		const cs = getComputedStyle(el);
		return {
			backgroundColor: cs.backgroundColor,
			backgroundImage: cs.backgroundImage,
			color: cs.color,
			padding: cs.padding,
			textTransform: cs.textTransform,
			variant: el.getAttribute('data-variant'),
		};
	});
}

test.describe('Invitation visual computed-style contracts (seed)', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	for (const seed of SEED) {
		test(`${seed.name}: critical section variants render`, async ({ page }) => {
			const response = await page.goto(seed.path, { waitUntil: 'domcontentloaded' });
			expect(response?.ok()).toBeTruthy();

			const hero = page.locator('.invitation-hero').first();
			await expect(hero).toBeVisible();
			await expect(hero).toHaveAttribute('data-variant', seed.heroVariant);

			const thankYou = page.locator('.thank-you-section').first();
			await expect(thankYou).toBeVisible();
			await expect(thankYou).toHaveAttribute('data-variant', seed.thankYouVariant);
		});
	}

	test('xareni thank-you: celestial light surface + plum ink (not dark plum slab)', async ({
		page,
	}) => {
		await page.goto('/xv/xareni-iyarit?skipEnvelope=true', { waitUntil: 'domcontentloaded' });
		const thankYou = await computed(page, '.thank-you-section');
		expect(thankYou.variant).toBe('editorial-back-cover');
		expect(thankYou.backgroundImage).toContain('linear-gradient');
		// Production light wash (remapped celestial tokens), not plum→mauve slab.
		expect(thankYou.backgroundImage).not.toMatch(
			/linear-gradient\(\s*150deg,\s*rgb\(58,\s*42,\s*46\)/i,
		);
		expect(thankYou.color).toBe('rgb(58, 42, 46)');

		const message = await computed(page, '.thank-you-section .thank-you-message');
		expect(message.color).toBe('rgba(58, 42, 46, 0.88)');

		const closing = await computed(page, '.thank-you-section .closing-name');
		expect(closing.color).toBe('rgb(58, 42, 46)');
	});

	test('alba thank-you: circular photo frame + no luxury message card', async ({ page }) => {
		await page.goto('/cumple/alba-rosa-quinonez?skipEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		const message = await computed(page, '.thank-you-section .thank-you-message');
		expect(message.backgroundImage).toBe('none');
		expect(message.padding).toBe('0px');
		expect(message.color).toBe('rgba(250, 248, 244, 0.94)');

		const closing = await computed(page, '.thank-you-section .closing-name');
		expect(closing.textTransform).toBe('none');
		expect(closing.backgroundImage).toBe('none');
		expect(closing.color).toBe('rgb(186, 164, 118)');

		const frame = await computed(page, '.thank-you-section .photo-frame');
		expect(frame.padding).toBe('0px');
		expect(
			await page
				.locator('.thank-you-section .photo-frame')
				.evaluate((el) => getComputedStyle(el).borderRadius),
		).toBe('50%');
	});

	test('celestial-blue thank-you & section order: editorial frame + early gallery', async ({
		page,
	}) => {
		await page.goto('/xv/demo-xv-celestial-blue?skipEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});

		const frame = page.locator('.thank-you-section .photo-frame');
		const frameRadius = await frame.evaluate((el) => getComputedStyle(el).borderRadius);
		expect(frameRadius).not.toBe('50%');

		const imageShell = page.locator('.thank-you-section .thank-you-editorial__image-shell');
		await expect(imageShell).toBeVisible();

		const sections = await page.$$eval('.invitation-section-wrapper', (els) =>
			els.map((el) => el.getAttribute('data-section-kind')),
		);
		const galleryIndex = sections.indexOf('gallery');
		const countdownIndex = sections.indexOf('countdown');
		expect(galleryIndex).toBeGreaterThan(-1);
		expect(countdownIndex).toBeGreaterThan(-1);
		expect(galleryIndex).toBeLessThan(countdownIndex);
	});

	test('romina hero: split-cover Parisienne ivory title (not gradient gold display)', async ({
		page,
	}) => {
		await page.goto('/xv/romina-rios-chaparro?skipEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		const hero = await computed(page, '.invitation-hero');
		expect(hero.variant).toBe('split-cover');
		// Production mobile inset (editorial 1rem); do not zero-pad split-cover.
		expect(hero.padding).toBe('16px');
		expect(
			await page
				.locator('.invitation-hero')
				.evaluate((el) => getComputedStyle(el).justifyContent),
		).toBe('space-between');

		const title = page.locator('.invitation-hero__title').first();
		const titleStyle = await title.evaluate((el) => {
			const cs = getComputedStyle(el);
			return {
				font: cs.fontFamily.toLowerCase(),
				color: cs.color,
				fill: cs.webkitTextFillColor,
				weight: cs.fontWeight,
			};
		});
		expect(titleStyle.font).toContain('parisienne');
		expect(titleStyle.color).toBe('rgb(246, 241, 232)');
		expect(titleStyle.fill).toBe('rgb(246, 241, 232)');
		expect(titleStyle.weight).toBe('400');
	});

	test('ana-sofia hero: celestial surface tokens on standard hero', async ({ page }) => {
		await page.goto('/xv/ana-sofia-cota-guillen?skipEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		const hero = await computed(page, '.invitation-hero');
		expect(hero.variant).toBe('standard');
		expect(hero.backgroundColor).toBe('rgb(16, 24, 32)');
		expect(hero.color).toBe('rgb(255, 255, 255)');
	});

	test('valentina: editorial magazine variants stay structural (not standard collapse)', async ({
		page,
	}) => {
		await page.goto('/xv/valentina-hernandez?skipEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		await expect(page.locator('.invitation-hero')).toHaveAttribute(
			'data-variant',
			'editorial-cover',
		);
		await expect(page.locator('.countdown-section')).toHaveAttribute(
			'data-variant',
			'magazine-folio',
		);
		await expect(page.locator('.gallery-section')).toHaveAttribute(
			'data-variant',
			'magazine-spread',
		);
		await expect(page.locator('.thank-you-section')).toHaveAttribute(
			'data-variant',
			'editorial-back-cover',
		);
		await expect(page.locator('.event-location__indications-heading')).toContainText(
			/guía privada/i,
		);
		await expect(page.locator('.event-location__indication-number').first()).toHaveText('01');
	});
});
