import { test, expect } from '@playwright/test';
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

	test('an unpaid invitation shows the preview marks and only watermarked photos', async ({
		page,
		request,
	}) => {
		await page.goto(`/${eventType}/${CANONICAL_ACCESS_FIXTURE_SLUGS.unpaid}?skipEnvelope=true`);

		await expect(page.locator('[data-preview-banner]')).toHaveText('Vista previa · Celebra-me');
		await expect(page.locator('[data-preview-stamp]').first()).toBeAttached();
		const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
		expect(ogImage).toMatch(/\/vista-previa\/[A-Za-z0-9_-]+\.jpg$/);

		const sources = await page
			.locator('img')
			.evaluateAll((images) => images.map((image) => image.getAttribute('src') ?? ''));
		const previewSources = sources.filter((src) => src.startsWith('/vista-previa/'));
		expect(previewSources.length).toBeGreaterThan(0);

		const photo = await request.get(previewSources[0]);
		expect(photo.status()).toBe(200);
		expect(photo.headers()['content-type']).toBe('image/webp');
		expect(photo.headers()['x-robots-tag']).toContain('noindex');
	});

	test('a paid client invitation shows no preview marks', async ({ page }) => {
		const paid = resolveCanonicalAccessFixtureSource();
		const response = await page.goto(`/${paid.eventType}/${paid.slug}?skipEnvelope=true`);
		expect(response?.status()).toBe(200);
		await expect(page.locator('[data-preview-banner]')).toHaveCount(0);
		await expect(page.locator('[data-preview-stamp]')).toHaveCount(0);
	});

	test('static demos stay indexable', async ({ page }) => {
		const response = await page.goto('/xv/demo-xv-enchanted-rose');

		expect(response?.status()).toBe(200);
		expect(response?.headers()['x-robots-tag']).toBeUndefined();
		await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
	});
});
