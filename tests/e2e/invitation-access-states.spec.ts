import { test, expect } from '@playwright/test';
import { DEMO_INVITATIONS } from '@/invitations/demos';
import {
	CANONICAL_ACCESS_FIXTURE_SLUGS,
	resolveCanonicalAccessFixtureEventType,
	resolveCanonicalAccessFixtureSource,
} from '../../scripts/playwright/canonical-access-fixture';

const eventType = resolveCanonicalAccessFixtureEventType();

test.describe('Invitation access states', () => {
	test('a disabled invitation renders the neutral page with 403 and no event data', async ({
		page,
	}) => {
		const response = await page.goto(
			`/${eventType}/${CANONICAL_ACCESS_FIXTURE_SLUGS.disabled}`,
		);

		expect(response?.status()).toBe(403);
		expect(response?.headers()['cache-control']).toBe('no-store, private');
		expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow, noarchive');
		await expect(page.locator('[data-invitation-unavailable] h1')).toHaveText(
			'Esta invitación no está disponible por el momento.',
		);
		await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
		await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			'content',
			'noindex, nofollow, noarchive',
		);
		await expect(page.locator('.event-theme-wrapper')).toHaveCount(0);
	});

	test('a disabled invitation ignores personalization', async ({ page }) => {
		const response = await page.goto(
			`/${eventType}/${CANONICAL_ACCESS_FIXTURE_SLUGS.disabled}?invite=invite-1`,
		);

		expect(response?.status()).toBe(403);
		const url = new URL(page.url());
		expect(url.pathname).toBe(`/${eventType}/${CANONICAL_ACCESS_FIXTURE_SLUGS.disabled}`);
		expect(url.searchParams.get('invite')).toBe('invite-1');
		await expect(page.locator('[data-invitation-unavailable]')).toBeVisible();
	});

	test('a nonexistent invitation renders the same neutral page with 404', async ({ page }) => {
		const response = await page.goto(`/${eventType}/fixture-access-missing`);

		expect(response?.status()).toBe(404);
		expect(response?.headers()['cache-control']).toBe('no-store, private');
		await expect(page.locator('[data-invitation-unavailable]')).toBeVisible();
	});

	test('an unpaid invitation stays reachable and is never indexed', async ({ page }) => {
		const response = await page.goto(`/${eventType}/${CANONICAL_ACCESS_FIXTURE_SLUGS.unpaid}`);

		expect(response?.status()).toBe(200);
		expect(response?.headers()['cache-control']).toBe(
			'public, max-age=0, s-maxage=0, must-revalidate',
		);
		expect(response?.headers()['x-robots-tag']).toBe(
			'noindex, nofollow, noarchive, noimageindex',
		);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			'content',
			'noindex, nofollow, noarchive, noimageindex',
		);
	});

	test('an unpaid invitation shows only the preview banner over its original photos', async ({
		page,
	}) => {
		await page.goto(`/${eventType}/${CANONICAL_ACCESS_FIXTURE_SLUGS.unpaid}?skipEnvelope=true`);

		await expect(page.locator('[data-preview-banner]')).toHaveText('Vista previa · Celebra-me');
		const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
		expect(ogImage).not.toContain('/vista-previa/');

		const sources = await page
			.locator('img')
			.evaluateAll((images) => images.map((image) => image.getAttribute('src') ?? ''));
		expect(sources.length).toBeGreaterThan(0);
		expect(sources.filter((src) => src.includes('/vista-previa/'))).toEqual([]);
	});

	test('a paid client invitation shows no preview marks', async ({ page }) => {
		const paid = resolveCanonicalAccessFixtureSource();
		const response = await page.goto(`/${paid.eventType}/${paid.slug}?skipEnvelope=true`);
		expect(response?.status()).toBe(200);
		await expect(page.locator('[data-preview-banner]')).toHaveCount(0);
	});

	test('public static demos stay indexable and allow large previews', async ({ page }) => {
		const response = await page.goto('/rose?skipEnvelope=true');

		expect(response?.status()).toBe(200);
		expect(response?.headers()['x-robots-tag']).toBe('index, follow, max-image-preview:large');
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			'content',
			'index, follow, max-image-preview:large',
		);
	});

	for (const demo of DEMO_INVITATIONS.filter(
		(demo) =>
			demo.showroom.visibility !== 'featured' || demo.showroom.reviewStatus !== 'approved',
	)) {
		test(`hidden static demo ${demo.routeSlug} stays unindexed`, async ({ page }) => {
			const response = await page.goto(`/${demo.routeSlug}?skipEnvelope=true`);

			expect(response?.status()).toBe(200);
			expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
			await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
				'content',
				'noindex, nofollow',
			);
		});
	}
});
