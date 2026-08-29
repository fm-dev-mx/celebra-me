import { test, expect } from '@playwright/test';
import {
	VALENTINA_MEMORIES_RECOVERY_ROUTE_PATH,
	VALENTINA_MEMORIES_ROUTE_PATH,
	valentinaMemoriesCaptureCopy,
	valentinaMemoriesPageCopy,
} from '../../src/data/valentina-memories.data';

const STUB_PUT_URL = 'https://r2-stub.test/private-put-capability';
const PROFILE = {
	displayName: 'Tía Ana',
	expiresAt: '2026-09-28T00:00:00.000Z',
};

async function uploadSampleJpeg(page: import('@playwright/test').Page) {
	const fileInput = page.locator('[data-capture="valentina-memories"] input[type="file"]');
	await expect(fileInput).toBeEnabled();
	await fileInput.setInputFiles({
		name: 'foto.jpg',
		mimeType: 'image/jpeg',
		buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
	});
}

async function waitForHydratedIsland(
	page: import('@playwright/test').Page,
	descendantSelector: string,
) {
	const island = page.locator('astro-island').filter({ has: page.locator(descendantSelector) });
	await expect(island).toHaveCount(1);
	await expect(island).not.toHaveAttribute('ssr', '');
}

test.describe('Valentina Memories capture route', () => {
	test('keeps the primary mobile controls visible, labelled, and touch friendly', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.route('**/api/memories/valentina/session', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ profile: null }),
			}),
		);
		await page.goto(VALENTINA_MEMORIES_ROUTE_PATH, { waitUntil: 'domcontentloaded' });
		await waitForHydratedIsland(page, '[data-capture="valentina-memories"]');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText(
			valentinaMemoriesPageCopy.heading,
		);
		await expect(page.getByLabel('Su nombre o apodo')).toBeVisible();
		const continueButton = page.getByRole('button', { name: 'Continuar' });
		const uploadButton = page.getByText(valentinaMemoriesCaptureCopy.chooseFile, {
			exact: true,
		});
		await expect(continueButton).toBeVisible();
		await expect(uploadButton).toBeVisible();
		const continueBox = await continueButton.boundingBox();
		const uploadBox = await uploadButton.boundingBox();
		expect(continueBox?.height).toBeGreaterThanOrEqual(44);
		expect(uploadBox?.height).toBeGreaterThanOrEqual(44);
		expect((uploadBox?.y ?? 844) + (uploadBox?.height ?? 0)).toBeLessThanOrEqual(844);
	});

	test('onboards, reserves same-origin, uploads directly, and completes without private fields', async ({
		page,
	}) => {
		let reservePayload: Record<string, unknown> | undefined;
		const outgoingHosts: string[] = [];
		page.on('request', (request) => outgoingHosts.push(new URL(request.url()).hostname));

		await page.route('**/api/memories/valentina/session', async (route) => {
			if (route.request().method() === 'POST') {
				await route.fulfill({
					status: 201,
					contentType: 'application/json',
					body: JSON.stringify({ profile: PROFILE, recoveryCode: 'ABCD-2345-EFGH' }),
				});
				return;
			}
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ profile: null }),
			});
		});
		await page.route('**/api/memories/valentina/items**', async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			if (request.method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ items: [] }),
				});
				return;
			}
			if (request.method() === 'POST' && url.pathname.endsWith('/items')) {
				reservePayload = request.postDataJSON() as Record<string, unknown>;
				await route.fulfill({
					status: 201,
					contentType: 'application/json',
					body: JSON.stringify({
						item: {
							id: 'media-e2e',
							mimeType: 'image/jpeg',
							sizeBytes: 4,
							caption: '',
							status: 'uploading',
							createdAt: '2026-08-29T00:00:00.000Z',
						},
						upload: {
							uploadUrl: STUB_PUT_URL,
							requiredHeaders: {
								'Content-Type': 'image/jpeg',
								'If-None-Match': '*',
								'x-amz-checksum-sha256': 'synthetic-checksum',
							},
						},
					}),
				});
				return;
			}
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ item: { id: 'media-e2e', status: 'accepted' } }),
			});
		});
		await page.route(STUB_PUT_URL, async (route) => {
			expect(route.request().method()).toBe('PUT');
			expect(route.request().headers()['content-type']).toBe('image/jpeg');
			expect(route.request().headers()['if-none-match']).toBe('*');
			expect(route.request().headers()['x-amz-checksum-sha256']).toBe('synthetic-checksum');
			await route.fulfill({ status: 412, body: '' });
		});

		const response = await page.goto(VALENTINA_MEMORIES_ROUTE_PATH, {
			waitUntil: 'domcontentloaded',
		});
		expect(response?.status()).toBe(200);
		await waitForHydratedIsland(page, '[data-capture="valentina-memories"]');
		await expect(page.locator('h1.status-page__title')).toHaveText(
			valentinaMemoriesPageCopy.heading,
		);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			'content',
			valentinaMemoriesPageCopy.robots,
		);
		await expect(page.locator('[data-page="valentina-memories"]')).toBeVisible();
		await expect(page.locator('.event-theme-wrapper')).toHaveCount(0);

		await page.getByLabel('Nombre o apodo').fill(PROFILE.displayName);
		await page.getByRole('button', { name: 'Continuar' }).click();
		await expect(page.getByText(new RegExp(PROFILE.displayName))).toBeVisible();
		await expect(page.getByText(/Alias de su sesión/i)).toHaveCount(0);
		await uploadSampleJpeg(page);

		await expect(page.getByText(valentinaMemoriesCaptureCopy.success)).toBeVisible();
		expect(reservePayload).toMatchObject({
			action: 'reserve',
			mimeType: 'image/jpeg',
			sizeBytes: 4,
			checksumSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
			clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
		});
		expect(reservePayload?.objectKey).toBeUndefined();
		expect(outgoingHosts).not.toContain('memories.celebra-me.com');
		await expect(page.getByText(/events\/valentina|X-Amz-|objectKey/i)).toHaveCount(0);
	});

	test('shows a retryable user-safe error when same-origin reservation is rejected', async ({
		page,
	}) => {
		await page.route('**/api/memories/valentina/session', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ profile: PROFILE }),
			});
		});
		await page.route('**/api/memories/valentina/items**', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: '{"items":[]}',
				});
				return;
			}
			await route.fulfill({
				status: 400,
				contentType: 'application/json',
				body: JSON.stringify({ error: { code: 'unsupported_mime' } }),
			});
		});

		await page.goto(VALENTINA_MEMORIES_ROUTE_PATH, { waitUntil: 'domcontentloaded' });
		await waitForHydratedIsland(page, '[data-capture="valentina-memories"]');
		await expect(page.getByText(new RegExp(PROFILE.displayName))).toBeVisible();
		await uploadSampleJpeg(page);
		await expect(page.getByRole('alert')).toHaveText(
			valentinaMemoriesCaptureCopy.unsupportedType,
		);
		await expect(
			page.getByRole('button', { name: valentinaMemoriesCaptureCopy.retry }),
		).toBeVisible();
	});

	test('recovers on a separate noindex page without placing the code in the URL', async ({
		page,
	}) => {
		let recoveryBody: Record<string, unknown> | undefined;
		await page.route('**/api/memories/valentina/session', async (route) => {
			if (route.request().method() === 'POST') {
				recoveryBody = route.request().postDataJSON() as Record<string, unknown>;
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ profile: PROFILE, recovered: true }),
				});
				return;
			}
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ profile: PROFILE }),
			});
		});
		await page.route('**/api/memories/valentina/items', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '{"items":[]}' }),
		);

		await page.goto(VALENTINA_MEMORIES_RECOVERY_ROUTE_PATH, {
			waitUntil: 'domcontentloaded',
		});
		await waitForHydratedIsland(page, '.status-page__recovery-form');
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
		await page.getByLabel('Código de recuperación').fill('ABCD-2345-EFGH');
		await page.getByRole('button', { name: 'Recuperar recuerdos' }).click();

		await expect(page).toHaveURL(new RegExp(`${VALENTINA_MEMORIES_ROUTE_PATH}#mis-recuerdos$`));
		expect(recoveryBody).toEqual({ action: 'recover', recoveryCode: 'ABCD-2345-EFGH' });
		expect(page.url()).not.toContain('ABCD-2345-EFGH');
	});
});
