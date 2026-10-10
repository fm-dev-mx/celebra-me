import { test, expect } from '@playwright/test';
import {
	CANONICAL_ACCESS_FIXTURE_SLUGS,
	resolveCanonicalAccessFixtureEventType,
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

	test('static demos stay indexable', async ({ page }) => {
		const response = await page.goto('/xv/demo-xv-enchanted-rose');

		expect(response?.status()).toBe(200);
		expect(response?.headers()['x-robots-tag']).toBeUndefined();
		await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
	});
});
