import { test, expect } from '@playwright/test';
import { DEMO_INVITATIONS } from '@/invitations/demos';

test.describe('Demo Routing Parity', () => {
	for (const width of [390, 1440]) {
		test(`Brisa keeps five gallery photos and two independent venue cards @ ${width}`, async ({
			page,
		}) => {
			await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
			const response = await page.goto('/brisa?skipEnvelope=true');
			expect(response?.status()).toBe(200);
			await expect(page.locator('[data-gallery-track] [data-gallery-item]')).toHaveCount(5);
			await expect(page.locator('.demo-conversion')).toHaveCount(2);
			await expect(page.locator('.event-location__card')).toHaveCount(2);
			const mapLinks = await page
				.locator('.event-location__nav-button--directions')
				.evaluateAll((links) => links.map((link) => link.getAttribute('href')));
			expect(mapLinks).toHaveLength(2);
			expect(new Set(mapLinks).size).toBe(2);
			const photos = await page
				.locator('[data-gallery-track] [data-gallery-item]')
				.evaluateAll((items) => items.map((item) => item.getAttribute('data-gallery-src')));
			expect(new Set(photos).size).toBe(5);
			const sections = await page
				.locator('.invitation-section-wrapper[data-section-kind]')
				.evaluateAll((items) =>
					items.map((item) => item.getAttribute('data-section-kind')),
				);
			expect(sections.slice(0, 5)).toEqual([
				'quote',
				'countdown',
				'interlude',
				'family',
				'interlude',
			]);
			await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/brisa$/);
		});
	}
	for (const viewport of [
		{ width: 375, height: 812 },
		{ width: 1024, height: 768 },
	]) {
		test(`quotes from a floating button and moves to the next demo @ ${viewport.width}`, async ({
			page,
		}) => {
			await page.addInitScript(() => {
				// Keep the cookie banner closed: the floating quote yields to it.
				window.localStorage.setItem(
					'cm_consent',
					JSON.stringify({
						necessary: true,
						analytics: false,
						marketing: false,
						updatedAt: new Date().toISOString(),
					}),
				);
			});
			await page.setViewportSize(viewport);
			await page.goto('/celestial?skipEnvelope=true');
			const floating = page.locator('[data-demo-floating-quote]');
			await expect(floating).not.toHaveClass(/demo-floating-quote--visible/);
			await page.locator('[data-section-kind="location"]').scrollIntoViewIfNeeded();
			await expect(floating).toHaveClass(/demo-floating-quote--visible/);
			await expect(floating).toHaveAttribute('data-track-cta', 'demo_quote_floating');
			const text = async (link: ReturnType<typeof page.locator>) =>
				new URL((await link.getAttribute('href')) ?? '').searchParams.get('text');
			expect(await text(floating)).toMatch(/Ref\. XV-CELESTIAL-FLOTANTE$/);

			const closing = page.locator('.demo-conversion[data-placement="closing"]');
			await closing.scrollIntoViewIfNeeded();
			await expect(floating).not.toHaveClass(/demo-floating-quote--visible/);
			expect(await text(closing.locator('.demo-conversion__primary'))).toMatch(
				/Ref\. XV-CELESTIAL-CIERRE$/,
			);
			await expect(closing.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute(
				'href',
				'/#xv',
			);
			const next = closing.locator('.demo-conversion__next');
			await expect(next).toContainText('Enchanted Rose');
			await next.click();
			await expect(page).toHaveURL(/\/rose$/);
		});
	}
	test('resolves Brisa and permanently redirects its retired URL with query parameters', async ({
		request,
	}) => {
		const legacy = await request.get(
			'/boda/demo-boda-jewelry-box-wedding?skipEnvelope=true&utm_source=shared',
			{ maxRedirects: 0 },
		);
		expect(legacy.status()).toBe(301);
		expect(legacy.headers().location).toBe('/brisa?skipEnvelope=true&utm_source=shared');
		const current = await request.get('/brisa?skipEnvelope=true');
		expect(current.status()).toBe(200);
		const html = await current.text();
		expect(html).toContain('event--demo-brisa');
		expect(html).toContain('canonical');
		expect(html).not.toContain('href="/boda/demo-boda-jewelry-box-wedding');
	});
	for (const demo of DEMO_INVITATIONS) {
		test(`moves the long ${demo.slug} URL to /${demo.routeSlug} with its query`, async ({
			request,
		}) => {
			const long = await request.get(
				`/${demo.eventType}/${demo.slug}?ref=wa&skipEnvelope=true`,
				{
					maxRedirects: 0,
				},
			);
			expect(long.status()).toBe(301);
			expect(long.headers().location).toBe(`/${demo.routeSlug}?ref=wa&skipEnvelope=true`);
			const short = await request.get(`/${demo.routeSlug}?ref=wa&skipEnvelope=true`, {
				maxRedirects: 0,
			});
			expect(short.status()).toBe(200);
		});
	}
	test('keeps an unknown invitation unavailable publicly', async ({ request }) => {
		const response = await request.get('/cumple/e2e-nonexistent-invitation');
		expect(response.status()).toBe(404);
		expect(response.headers()['cache-control']).toBe('no-store, private');
	});
	test('uses correctness-first caching for public content and private caching for invalid routes', async ({
		request,
	}) => {
		const publicResponse = await request.get('/xv/demo-xv-enchanted-rose?skipEnvelope=true');
		expect(publicResponse?.headers()['cache-control']).toBe(
			'public, max-age=0, s-maxage=0, must-revalidate',
		);

		const invalidResponse = await request.get('/not-an-event/demo-xv-enchanted-rose');
		expect(invalidResponse?.status()).toBe(404);
		expect(invalidResponse?.headers()['cache-control']).toBe('no-store, private');
	});

	test('renders a public demo event correctly without an inviteId', async ({ page }) => {
		// A demo event provides high-fidelity showcase without requiring personalization
		const response = await page.goto('/xv/demo-xv-enchanted-rose?skipEnvelope=true', {
			waitUntil: 'domcontentloaded',
		});
		expect(response?.ok()).toBeTruthy();

		// Reveal interaction belongs to envelope-reveal-interaction.spec.ts.
		await expect(page.locator('.event-theme-wrapper')).toHaveAttribute(
			'data-reveal-state',
			'revealed',
		);

		// Core sections should mount correctly
		await expect(page.locator('#inicio')).toBeVisible();
		await expect(page.locator('#family-section')).toBeVisible();

		// The RSVP component should mount (even if in a limited demo mode or hybrid access mode)
		const rsvpSection = page.locator('#rsvp');
		await expect(rsvpSection).toBeVisible();
	});

	test('degrades gracefully without redirecting when demo route is accessed with invalid inviteId', async ({
		page,
	}) => {
		// The route personalization layer must catch errors but NOT block demo routes
		const response = await page.goto('/xv/demo-xv-enchanted-rose?invite=invalid-demo-id', {
			waitUntil: 'domcontentloaded',
		});
		expect(response?.ok()).toBeTruthy();

		// Validate that the URL remains intact and standard fallback rendering occurs
		const url = page.url();
		expect(url).toContain('invite=invalid-demo-id');
		await expect(page.locator('.event-theme-wrapper')).toBeVisible();
	});

	test.describe('Retired showroom pages', () => {
		for (const [path, hash] of [
			['/demos/xv', '#xv'],
			['/demos/boda', '#boda'],
			['/demos/bautizo', '#bautizo'],
			['/demos/bautismo', '#bautizo'],
			['/demos/primera-comunion', '#primera-comunion'],
			['/demos/cumpleanos', '#cumpleanos'],
		]) {
			test(`${path} moves permanently to the landing showroom`, async ({ request }) => {
				const response = await request.get(path, { maxRedirects: 0 });
				expect(response.status()).toBe(301);
				expect(response.headers().location).toBe(`/${hash}`);
			});
		}
	});

	test.describe('Showroom – event type without demos', () => {
		test('baby shower lands on the landing event selector', async ({ page }) => {
			await page.goto('/demos/baby-shower', { waitUntil: 'domcontentloaded' });
			expect(new URL(page.url()).pathname).toBe('/');
			expect(new URL(page.url()).hash).toBe('#tipo-evento');
		});
	});
});

for (const route of [
	'/bautizo/demo-bautizo-angelic-presence',
	'/primera-comunion/demo-primera-comunion-angelic-presence',
]) {
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 1440, height: 900 },
	]) {
		test(`interlude follows personalized access: ${route} @ ${viewport.width}`, async ({
			page,
		}) => {
			await page.setViewportSize(viewport);
			const response = await page.goto(`${route}?skipEnvelope=true&animations=off`);
			expect(response?.status()).toBe(200);
			const sections = page.locator(
				'.event-theme-wrapper .invitation-section-wrapper[data-section-kind]',
			);
			await expect(sections.nth(0)).toHaveAttribute('data-section-kind', 'quote');
			await expect(sections.nth(1)).toHaveAttribute(
				'data-section-kind',
				'personalized-access',
			);
			await expect(sections.nth(2)).toHaveAttribute('data-section-kind', 'interlude');
		});
	}
}
