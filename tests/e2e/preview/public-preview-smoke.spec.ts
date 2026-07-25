import { expect, test } from './public-preview-test';
import {
	PREVIEW_FIXTURE_DEMO_ID,
	PREVIEW_FIXTURE_EVENT_TYPE,
	PREVIEW_FIXTURE_SLUG,
} from '../../../scripts/playwright/preview-environment';

const relevantResourceTypes = new Set(['stylesheet', 'script', 'image', 'font']);

test('public routes and representative invitation assets load without runtime errors', async ({
	page,
}) => {
	const failedAssets: string[] = [];
	const loadedAssetTypes = new Set<string>();
	const browserErrors: string[] = [];

	page.on('response', (response) => {
		const resourceType = response.request().resourceType();
		if (!relevantResourceTypes.has(resourceType)) return;
		const pathname = new URL(response.url()).pathname;
		if (response.status() >= 400) {
			failedAssets.push(`${resourceType}:${response.status()}:${pathname}`);
			return;
		}
		loadedAssetTypes.add(resourceType);
	});
	page.on('console', (message) => {
		if (message.type() === 'error') browserErrors.push(message.text());
	});
	page.on('pageerror', (error) => browserErrors.push(error.message));

	const root = await page.goto('/', { waitUntil: 'networkidle' });
	expect(root?.status()).toBe(200);
	await expect(page.locator('main')).toBeVisible();

	const login = await page.goto('/login', { waitUntil: 'networkidle' });
	expect(login?.status()).toBe(200);
	await expect(page.locator('#login-submit')).toBeVisible();

	const health = await page.request.get('/api/health');
	expect(health.status()).toBe(200);
	const healthPayload = (await health.json()) as { status?: unknown };
	expect(healthPayload.status).toBe('healthy');

	const invitation = await page.goto(
		`/${PREVIEW_FIXTURE_EVENT_TYPE}/${PREVIEW_FIXTURE_DEMO_ID}`,
		{
			waitUntil: 'networkidle',
		},
	);
	expect(invitation?.status()).toBe(200);
	await expect(page.locator('main')).toBeVisible();

	expect(failedAssets).toEqual([]);
	expect(browserErrors).toEqual([]);
	for (const resourceType of relevantResourceTypes) {
		expect(loadedAssetTypes.has(resourceType)).toBe(true);
	}
});

test.describe('Synthetic published Preview fixture', () => {
	test.skip(
		!process.env.PLAYWRIGHT_PREVIEW_INVITATION_ID,
		'Requires PLAYWRIGHT_PREVIEW_INVITATION_ID after fixture provisioning.',
	);

	test('is reachable when its identifier is configured', async ({ page }) => {
		const response = await page.goto(`/${PREVIEW_FIXTURE_EVENT_TYPE}/${PREVIEW_FIXTURE_SLUG}`, {
			waitUntil: 'networkidle',
		});
		expect(response?.status()).toBe(200);
		await expect(page.locator('main')).toBeVisible();
	});
});
