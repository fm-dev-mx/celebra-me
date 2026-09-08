import { test, expect } from '@playwright/test';

const route =
	'/test/variant?full=1&presentation=1&eventType=cumple&slug=norma-margarita-hernandez-zabalsa';

for (const width of [360, 390, 768, 1440]) {
	test(`Norma album preserves full photographs and visible dedications at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto(route);
		await page.waitForLoadState('networkidle');
		await page.locator('.framed-portrait-hero img').waitFor();
		await page.evaluate(() => document.fonts.ready);
		const chapters = page.locator('[data-gallery-item]');
		await expect(chapters).toHaveCount(4);
		for (const chapter of await chapters.all()) {
			await chapter.scrollIntoViewIfNeeded();
			await expect(chapter.locator('.gallery-grid__caption')).toBeVisible();
			await expect(chapter.locator('.gallery-grid__overlay')).toHaveCSS('opacity', '1');
			await expect(chapter.locator('img')).toHaveCSS('object-fit', 'contain');
		}
		const overflow = await page.evaluate(() =>
			Array.from(document.querySelectorAll('section, h1, h2, p, [data-gallery-item]'))
				.filter((element) => {
					const r = element.getBoundingClientRect();
					return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
				})
				.map((element) => ({
					tag: element.tagName,
					className: element.className,
					width: element.getBoundingClientRect().width,
				})),
		);
		expect(overflow).toEqual([]);
		await expect(page.locator('audio')).toHaveCount(0);
		await page.screenshot({ path: `output/playwright/norma-${width}.png`, fullPage: true });
	});
}

test('Norma envelope opens with keyboard and reveals childhood first', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`${route}&envelope=1`);
	await page.waitForLoadState('networkidle');
	const seal = page.getByRole('button', { name: 'Abrir sobre de la invitación' });
	await expect(seal).toBeVisible();
	await expect(page.locator('#test-invitation-root')).toHaveAttribute(
		'data-reveal-state',
		'sealed',
	);
	await page.screenshot({ path: 'output/playwright/norma-envelope.png' });
	await seal.focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('#test-invitation-root')).toHaveAttribute(
		'data-reveal-state',
		'revealed',
	);
	await expect(page.locator('.envelope-wrapper')).toBeHidden();
	await expect(page.locator('#inicio img')).toBeVisible();
	await page.screenshot({ path: 'output/playwright/norma-opening.png' });
});

test('Norma remains readable with 200 percent text size and reduced motion', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(route);
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => {
		document.documentElement.style.fontSize = '200%';
	});
	const textOverflow = await page
		.locator('h1, .gallery-grid__caption, .thank-you-message')
		.evaluateAll((elements) =>
			elements
				.filter((element) => element.scrollWidth > element.clientWidth + 1)
				.map((element) => element.className),
		);
	expect(textOverflow).toEqual([]);
	await expect(page.locator('.framed-portrait-hero img')).toHaveCSS('object-fit', 'contain');
	await page.screenshot({ path: 'output/playwright/norma-text-200.png', fullPage: true });
});

test('Norma text palette meets normal-text contrast requirements', async ({ page }) => {
	await page.goto(route);
	await page.waitForLoadState('networkidle');
	const ratios = await page.locator('#test-invitation-root').evaluate((element) => {
		const style = getComputedStyle(element);
		const luminance = (token: string) => {
			const channels = style
				.getPropertyValue(token)
				.match(/[\d.]+/g)!
				.map(Number)
				.slice(0, 3)
				.map((c) => {
					const s = c / 255;
					return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
				});
			return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
		};
		return [
			['--color-text-primary', '--color-surface-primary'],
			['--color-text-primary', '--color-surface-secondary'],
			['--color-text-secondary', '--color-surface-primary'],
			['--color-action-accent', '--color-surface-primary'],
		].map(([foreground, background]) => {
			const a = luminance(foreground),
				b = luminance(background);
			return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
		});
	});
	for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('Norma album exposes dedications to assistive technology and opens its existing viewer', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(route);
	await page.waitForLoadState('networkidle');
	const chapter = page.locator('[data-gallery-item]').first();
	await expect(chapter).toHaveAccessibleDescription(/A ustedes, mis hijos/);
	await chapter.focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('dialog', { name: 'Vista ampliada de la imagen' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Vista ampliada de la imagen' })).toBeHidden();
});
